#!/usr/bin/env bash
# tests/api.test.sh — Wave A API tests for marvel-radar (ARCHITECTURE.md §12).
#
# Runs against a local function runtime (vercel dev, or the /tmp harness:
#   ROOT=<repo> PORT=3100 CRON_SECRET=testsecret node /tmp/marvel-api-harness/server.js)
# and against a preview URL.
#
#   BASE=http://localhost:3100 ./tests/api.test.sh
#   BASE=https://<preview>.vercel.app ./tests/api.test.sh
#
# Deps: bash, curl, python3 only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-http://localhost:3100}"

pass=0; fail=0
chk() { # chk <name> <command...>
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then pass=$((pass+1)); echo "ok   $name";
  else fail=$((fail+1)); echo "FAIL $name"; fi
}

# ---- envelope validator (ARCHITECTURE.md §1.10, interim gate until
#      server-program/validate_envelope.py ships) ----
VALIDATOR="$(mktemp)"
trap 'rm -f "$VALIDATOR"' EXIT
cat > "$VALIDATOR" <<'PYEOF'
import json, re, sys
from datetime import datetime
raw = sys.stdin.read()
try:
    e = json.loads(raw)
except Exception as ex:
    sys.exit("not JSON: %s" % ex)
assert isinstance(e.get("ok"), bool), "ok not boolean"
assert e.get("data") is None or isinstance(e["data"], (dict, list)), "data wrong type"
m = e.get("meta")
assert isinstance(m, dict), "meta not object"
assert re.match(r"^[a-z0-9-]+$", m.get("service", "")), "service pattern"
assert re.match(r"^[0-9]+\.[0-9]+\.[0-9]+$", m.get("version", "")), "version semver"
try:
    datetime.fromisoformat(m["generated_at"].replace("Z", "+00:00"))
except Exception:
    sys.exit("generated_at not RFC3339")
assert re.match(r"^req_[0-9a-f]{6}$", m.get("request_id", "")), "request_id pattern"
for k in ("source", "degraded", "stale_since", "upstream", "note"):
    if k in m:
        v = m[k]
        if k == "source": assert v in ("live", "cache", "static"), "source enum"
        if k == "degraded": assert isinstance(v, bool), "degraded bool"
        if k == "upstream":
            assert isinstance(v, list), "upstream list"
            for u in v:
                assert isinstance(u.get("source"), str) and isinstance(u.get("ok"), bool), "upstream entry"
                assert "checked_at" in u, "upstream checked_at"
if e["ok"]:
    assert "error" not in e, "ok:true must not carry error"
else:
    er = e.get("error")
    assert isinstance(er, dict), "ok:false needs error"
    assert er.get("code") in ("BAD_INPUT","UNAUTHORIZED","NOT_FOUND","RATE_LIMITED",
        "UPSTREAM_UNAVAILABLE","REFRESH_FAILED","INTERNAL"), "error code enum"
    assert isinstance(er.get("message"), str) and er["message"], "error message"
print("envelope ok")
PYEOF
validate() { python3 "$VALIDATOR"; }

echo "== marvel-radar api tests =="
echo "BASE=$BASE"

# 1. health: 200, ok:true envelope, roster matches §7.3 exactly
chk "health 200" curl -sf "$BASE/api/health"
chk "health envelope" bash -c "curl -sf '$BASE/api/health' | python3 '$VALIDATOR'"
chk "health roster" bash -c "curl -sf '$BASE/api/health' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert d['functions']==['reveals','preorders','cron/radar'], d['functions']
assert d['service']=='marvel-radar'\""
chk "health content-type" bash -c "curl -sf -D - -o /dev/null '$BASE/api/health' | grep -qi 'application/json'"
chk "health cache s-maxage=60" bash -c "curl -sf -D - -o /dev/null '$BASE/api/health' | grep -qi 's-maxage=60'"

# 2. roster endpoints return ok:true envelopes
for p in reveals preorders; do
  chk "envelope $p" bash -c "curl -sf '$BASE/api/$p' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is True, 'ok!=true'
import re; assert re.match(r'^req_[0-9a-f]{6}\$', e['meta']['request_id'])\""
done

# 3. reveals payload shape (§7.3): id/title/wave/figures/announced_at/sources/status/price_tbd
chk "reveals schema" bash -c "curl -sf '$BASE/api/reveals?limit=5' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert d['count']<=5
for r in d['reveals']:
    assert r['id'].startswith('rv_'), r['id']
    assert isinstance(r['title'],str) and r['title']
    assert r['wave'] is None and r['figures']==[]
    assert r['status'] in ('rumor','confirmed','preorder-live','released'), r['status']
    assert r['price_tbd'] is True  # never-assume-prices: always true on raw detections
    assert isinstance(r['sources'],list) and r['sources']
    assert all('name' in s and 'url' in s for s in r['sources'])\""

# 4. preorders payload shape (§7.3): goes_live_at, price_or_tbd, never-assumed prices
chk "preorders schema" bash -c "curl -sf '$BASE/api/preorders' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert d['count']>0
for p in d['preorders']:
    assert isinstance(p['name'],str) and p['name']
    assert p['price'] is None or isinstance(p['price'],(int,float)), p['price']
    assert p['price_tbd'] == (p['price'] is None), 'price_tbd must mirror price null-ness'
    assert p['goes_live_at'] is None or p['goes_live_at'].endswith('Z')\""

# 5. query validation gates
chk "reveals limit clamp" bash -c "curl -sf '$BASE/api/reveals?limit=500' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']; assert d['limit']==200\""
# NOTE: the spec's §12.2 example pipes `curl -sf` into the 400 assert, but -f
# makes curl exit 22 on a 400 before python ever runs — so -s (no -f) is used
# here. The intent (400 + BAD_INPUT envelope) is unchanged.
chk "bad limit 400" bash -c "curl -s '$BASE/api/reveals?limit=abc' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is False and e['error']['code']=='BAD_INPUT', e\""
chk "bad since 400" bash -c "curl -s '$BASE/api/reveals?since=not-a-date' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is False and e['error']['code']=='BAD_INPUT', e\""
chk "reveals since filter" bash -c "curl -sf '$BASE/api/reveals?since=2026-10-01' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert all(r['announced_at']>='2026-10-01' for r in d['reveals'])\""

# 6. cron auth gates (§8.3 fail closed)
chk "cron 401 no secret" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' '$BASE/api/cron/radar')\" = 401 ]"
chk "cron 401 bad secret" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer wrong' '$BASE/api/cron/radar')\" = 401 ]"
chk "cron 401 envelope" bash -c "curl -s '$BASE/api/cron/radar' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is False and e['error']['code']=='UNAUTHORIZED', e\""
chk "cron no-store" bash -c "curl -s -D - -o /dev/null '$BASE/api/cron/radar' | grep -qi 'no-store'"

# 7. static fallback present (the §3 contract)
chk "static fallback radar-candidates" bash -c "curl -sf '$BASE/api/v1/radar-candidates.json' -o /dev/null"
chk "static fallback preorders" bash -c "curl -sf '$BASE/api/v1/preorders.json' -o /dev/null"
chk "static fallback envelope schema" bash -c "curl -sf '$BASE/api/v1/schema/envelope.json' | python3 -c \"import json,sys; json.load(sys.stdin)\""

# 8. GET cache headers (§1.6): s-maxage=600 on resource functions
chk "reveals cache s-maxage=600" bash -c "curl -sf -D - -o /dev/null '$BASE/api/reveals?limit=1' | grep -qi 's-maxage=600'"
chk "preorders cache s-maxage=600" bash -c "curl -sf -D - -o /dev/null '$BASE/api/preorders' | grep -qi 's-maxage=600'"

# 9. vercel.json lint: cron daily-or-slower (Hobby hard limit, §4.1)
chk "cron daily-or-slower" python3 -c "
import json; v=json.load(open('$ROOT/vercel.json'))
crons=v.get('crons',[]); assert len(crons)==1, crons
for c in crons:
    f=c['schedule'].split()
    assert f[0]!='*' and '*/' not in f[0] and '*/' not in f[1], c
    assert c['path']=='/api/cron/radar', c"
chk "vercel.json runtime pin" python3 -c "
import json; v=json.load(open('$ROOT/vercel.json'))
assert v['functions']['api/**/*.js']['runtime']=='nodejs22.x', v['functions']"

# 10. load smoke (§12.5): 30 sequential hits, no 429s, report p95
chk "smoke no-429" bash -c "
bad=0; times='';
for i in \$(seq 1 30); do
  code=\$(curl -s -o /dev/null -w '%{http_code}' '$BASE/api/reveals?limit=2')
  [ \"\$code\" = 200 ] || bad=\$((bad+1))
done
[ \"\$bad\" = 0 ]"

# 11. rate limit gate (§1.7) — LAST: it intentionally exhausts the test IP bucket
chk "rate limit 429" bash -c "
hit=0
for i in \$(seq 1 70); do
  out=\$(curl -s -D - '$BASE/api/reveals?limit=1' -o /tmp/mlc_rl_body)
  code=\$(echo \"\$out\" | grep -i '^HTTP/' | tail -1 | awk '{print \$2}')
  if [ \"\$code\" = 429 ]; then
    grep -qi 'retry-after' <<< \"\$out\" || exit 1
    python3 -c \"
import json; e=json.load(open('/tmp/mlc_rl_body'))
assert e['ok'] is False and e['error']['code']=='RATE_LIMITED', e\" || exit 1
    hit=1; break
  fi
done
[ \"\$hit\" = 1 ]"

echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
