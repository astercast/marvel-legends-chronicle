# tests/site-checks.sh — marvel-legends-chronicle payload assertions.
# Sourced by tests/api.test.sh (canonical api-contract-test pattern) at
# section 3, with chk / VAL / BASE / AUTH_HEADER in scope. The CONTRACT
# (health, envelope schema, cron gates, static fallback, vercel lint,
# rate limiting) lives in api.test.sh; this file asserts only what is
# specific to this site's payloads (ARCHITECTURE.md §7.3).

# health: service name + exact roster order (§7.3)
chk "health service + roster order" bash -c "curl -sf '$BASE/api/health' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert d['functions']==['reveals','preorders','cron/radar'], d['functions']
assert d['service']=='marvel-radar'\""
chk "health content-type" bash -c "curl -sf -D - -o /dev/null '$BASE/api/health' | grep -qi 'application/json'"

# reveals payload shape (§7.3): id/title/wave/figures/announced_at/sources/status/price_tbd
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

# preorders payload shape (§7.3): goes_live_at, price_or_tbd, never-assumed prices
chk "preorders schema" bash -c "curl -sf '$BASE/api/preorders' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert d['count']>0
for p in d['preorders']:
    assert isinstance(p['name'],str) and p['name']
    assert p['price'] is None or isinstance(p['price'],(int,float)), p['price']
    assert p['price_tbd'] == (p['price'] is None), 'price_tbd must mirror price null-ness'
    assert p['goes_live_at'] is None or p['goes_live_at'].endswith('Z')\""

# query validation gates
chk "reveals limit clamp" bash -c "curl -sf '$BASE/api/reveals?limit=500' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']; assert d['limit']==200\""
# NOTE: -s (no -f) on the 400 asserts — -f makes curl exit 22 on a 400
# before python ever runs. Intent (400 + BAD_INPUT envelope) unchanged.
chk "bad limit 400" bash -c "curl -s '$BASE/api/reveals?limit=abc' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is False and e['error']['code']=='BAD_INPUT', e\""
chk "bad since 400" bash -c "curl -s '$BASE/api/reveals?since=not-a-date' | python3 -c \"
import json,sys; e=json.load(sys.stdin)
assert e['ok'] is False and e['error']['code']=='BAD_INPUT', e\""
chk "reveals since filter" bash -c "curl -sf '$BASE/api/reveals?since=2026-10-01' | python3 -c \"
import json,sys; d=json.load(sys.stdin)['data']
assert all(r['announced_at']>='2026-10-01' for r in d['reveals'])\""

# vercel.json: this site's exact function roster (the canonical lint
# already asserts maxDuration-only / no-runtime on every entry)
chk "vercel.json function paths" python3 -c "
import json; v=json.load(open('vercel.json'))
want={'api/health.js','api/reveals.js','api/preorders.js','api/cron/radar.js'}
assert set(v['functions'].keys())==want, v['functions']
assert [c['path'] for c in v.get('crons',[])]==['/api/cron/radar'], v.get('crons')"

# load smoke (§12.5): 30 sequential hits, no 429s (the canonical rate-
# limit section runs last and exhausts the bucket on purpose)
chk "smoke no-429" bash -c "
bad=0
for i in \$(seq 1 30); do
  code=\$(curl -s -o /dev/null -w '%{http_code}' '$BASE/api/reveals?limit=2')
  [ \"\$code\" = 200 ] || bad=\$((bad+1))
done
[ \"\$bad\" = 0 ]"
