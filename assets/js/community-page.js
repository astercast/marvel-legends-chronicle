/* Community page UI, feed, composer, discovery, profiles. */
import { loadData, figureById, searchFigures } from "./data.js";
import { openFigureDialog, escapeHtml } from "./figure-dialog.js";
import {
  loadSocial, persist, getUser, getFeed, getUserPosts, toggleLike, toggleFollow,
  isLiked, isFollowing, addComment, createPost, statsFor, timeAgo, searchPosts,
} from "./community.js";

let social = null;
let figIndex = null; // Map<figId, figure>
let view = { tab: "feed", feedFilter: "all", profileId: null, discoverQuery: "" };
let composerTags = []; // selected figure ids

const els = {
  tabs: document.getElementById("community-tabs"),
  main: document.getElementById("community-main"),
};

/* ---------- shared render helpers ---------- */

function avatarHtml(user, size = "") {
  const initial = escapeHtml(user.name.charAt(0).toUpperCase());
  return `<span class="avatar ${size}" aria-hidden="true">${initial}</span>`;
}

function captionHtml(caption) {
  return escapeHtml(caption).replace(/#(\w+)/g, `<span class="hashtag">#$1</span>`);
}

function tagLabel(figId) {
  const fig = figIndex?.get(figId);
  if (fig) return fig.variant ? `${fig.name} (${fig.variant})` : fig.name;
  return figId.split("::")[1] ?? figId;
}

function tagChipsHtml(post) {
  if (!post.figureTags?.length) return "";
  return `<div class="figure-tags" role="list" aria-label="Tagged figures">${post.figureTags
    .map((id) => `<button type="button" class="badge" role="listitem" data-fig-tag="${escapeHtml(id)}">${escapeHtml(tagLabel(id))}</button>`)
    .join("")}</div>`;
}

function postCard(post) {
  const user = getUser(social, post.userId);
  const liked = isLiked(social, post.id);
  const likeCount = (social.likes[post.id] ?? []).length;
  const comments = social.comments[post.id] ?? [];
  const art = post.image
    ? `<div class="post-photo"><img src="${post.image}" alt="Fan photo for: ${escapeHtml(post.caption.slice(0, 80))}"></div>`
    : `<div class="post-photo" style="background:var(--board)" aria-hidden="true"></div>`;

  const el = document.createElement("article");
  el.className = "post";
  el.dataset.postId = post.id;
  el.innerHTML = `
    <div class="post-head">
      ${avatarHtml(user)}
      <div>
        <button type="button" class="post-author" data-profile="${escapeHtml(user.id)}">${escapeHtml(user.name)}</button>
        <div class="post-time">${timeAgo(post.ts)}</div>
      </div>
      ${post.userId !== "you" ? `<button type="button" class="btn btn-sm btn-ghost follow-btn" data-follow="${escapeHtml(user.id)}">${isFollowing(social, user.id) ? "Following" : "Follow"}</button>` : ""}
    </div>
    ${art}
    <div class="post-body">
      <p class="post-caption"><strong>${escapeHtml(user.name)}</strong> ${captionHtml(post.caption)}</p>
      ${tagChipsHtml(post)}
    </div>
    <div class="post-actions">
      <button type="button" class="like-btn" data-like="${post.id}" aria-pressed="${liked}" aria-label="${liked ? "Unlike" : "Like"} this post">
        <span aria-hidden="true">${liked ? "♥" : "♡"}</span> <span data-like-count>${likeCount}</span>
      </button>
      <span class="comment-count">${comments.length} comment${comments.length === 1 ? "" : "s"}</span>
    </div>
    <div class="comments" data-comments>
      ${comments.map((c) => `<div class="comment"><strong>${escapeHtml(c.author)}</strong>${escapeHtml(c.text)}</div>`).join("")}
      <form class="comment-form" data-comment-form="${post.id}">
        <label class="visually-hidden" for="c-${post.id}">Add a comment</label>
        <input class="input" id="c-${post.id}" name="comment" maxlength="500" placeholder="Add a comment…" autocomplete="off">
        <button type="submit" class="btn btn-sm">Post</button>
      </form>
    </div>`;
  return el;
}

/* ---------- views ---------- */

function renderTabs() {
  const tabs = [
    ["feed", "Feed"],
    ["discover", "Discover"],
    ["profile", view.profileId && view.profileId !== "you" ? `@${view.profileId}` : "My shelf"],
  ];
  els.tabs.innerHTML = "";
  for (const [id, label] of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost";
    btn.setAttribute("aria-selected", String(view.tab === id));
    btn.textContent = label;
    btn.addEventListener("click", () => {
      view = { ...view, tab: id, profileId: id === "profile" ? view.profileId ?? "you" : view.profileId };
      render();
    });
    els.tabs.appendChild(btn);
  }
}

function renderFeed() {
  const wrap = document.createElement("div");

  // Composer
  const composer = document.createElement("section");
  composer.className = "card composer";
  composer.setAttribute("aria-label", "Create a post");
  composer.innerHTML = `
    <h2 style="font-size:1.05rem;margin-bottom:var(--space-3);">Share your shelf</h2>
    <div class="field" style="margin-bottom:var(--space-3);">
      <label for="composer-caption">Caption</label>
      <textarea class="input" id="composer-caption" maxlength="1000" placeholder="Show off a figure, a haul, a custom… #marvellegends"></textarea>
    </div>
    <div class="field" style="margin-bottom:var(--space-3);">
      <label for="composer-photo">Photo</label>
      <input class="input" type="file" id="composer-photo" accept="image/*">
      <div class="composer-preview" id="composer-preview" hidden></div>
    </div>
    <div class="field" style="margin-bottom:var(--space-3);">
      <label for="composer-tag-search">Tag figures</label>
      <input class="input" id="composer-tag-search" placeholder="Type a figure name…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="tag-results">
      <div class="tag-search-results" id="tag-results" role="listbox" hidden></div>
      <div class="tag-picks" id="tag-picks"></div>
    </div>
    <button type="button" class="btn btn-primary" id="composer-submit">Post</button>`;
  wrap.appendChild(composer);

  // Feed filter
  const filterRow = document.createElement("div");
  filterRow.className = "btn-row";
  filterRow.style.marginBottom = "var(--space-4)";
  for (const [val, label] of [["all", "All posts"], ["following", "Following"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm" + (view.feedFilter === val ? " btn-gold" : "");
    b.textContent = label;
    b.addEventListener("click", () => { view.feedFilter = val; render(); });
    filterRow.appendChild(b);
  }
  wrap.appendChild(filterRow);

  const feed = document.createElement("div");
  feed.className = "feed";
  const posts = getFeed(social, view.feedFilter);
  if (!posts.length) {
    feed.innerHTML = `<div class="empty-state"><p>Nothing here yet, follow collectors in Discover, or share your first post above.</p></div>`;
  } else {
    for (const p of posts) feed.appendChild(postCard(p));
  }
  wrap.appendChild(feed);
  wireComposer(composer);
  return wrap;
}

function renderDiscover() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="field grow" style="margin-bottom:var(--space-4);max-width:480px;">
      <label for="discover-search">Search posts</label>
      <input class="input" id="discover-search" placeholder="Try #baf, shelfie, custom…" value="${escapeHtml(view.discoverQuery)}">
    </div>
    <h2 style="font-size:1.1rem;">Collectors to follow</h2>
    <div class="feed" id="discover-users" style="margin-bottom:var(--space-6);"></div>
    <h2 style="font-size:1.1rem;">Matching posts</h2>
    <div class="feed" id="discover-posts"></div>`;

  const users = document.createElement("div");
  const userList = Object.values(social.users);
  const userWrap = wrap.querySelector("#discover-users");
  for (const u of userList) {
    const row = document.createElement("div");
    row.className = "card";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "var(--space-3)";
    row.innerHTML = `
      ${avatarHtml(u)}
      <div style="flex:1;">
        <button type="button" class="post-author" data-profile="${u.id}">${escapeHtml(u.name)}</button>
        <div style="font-size:0.85rem;color:var(--muted);">${escapeHtml(u.bio)}</div>
      </div>
      <button type="button" class="btn btn-sm" data-follow="${u.id}">${isFollowing(social, u.id) ? "Following" : "Follow"}</button>`;
    userWrap.appendChild(row);
  }

  const renderMatches = () => {
    const box = wrap.querySelector("#discover-posts");
    box.innerHTML = "";
    const matches = searchPosts(social, view.discoverQuery);
    if (view.discoverQuery.trim().length >= 2 && !matches.length) {
      box.innerHTML = `<div class="empty-state"><p>No posts match that search.</p></div>`;
      return;
    }
    for (const p of (matches.length ? matches : getFeed(social, "all").slice(0, 5))) box.appendChild(postCard(p));
  };
  let debounce;
  wrap.querySelector("#discover-search").addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { view.discoverQuery = e.target.value; renderMatches(); }, 200);
  });
  renderMatches();
  return wrap;
}

function renderProfile() {
  const userId = view.profileId ?? "you";
  const user = getUser(social, userId);
  const stats = statsFor(social, userId);
  const wrap = document.createElement("div");

  const head = document.createElement("div");
  head.className = "profile-head";
  head.innerHTML = `
    ${avatarHtml(user)}
    <div style="flex:1;min-width:200px;">
      <h2 style="margin:0;">${escapeHtml(user.name)}</h2>
      <p style="color:var(--muted);font-size:0.9rem;margin:var(--space-1) 0;">${escapeHtml(user.bio || "")}</p>
      <div class="profile-stats">
        <div><span class="num">${stats.posts}</span><span class="lbl">Posts</span></div>
        <div><span class="num">${stats.followers}</span><span class="lbl">Followers</span></div>
        <div><span class="num">${stats.following}</span><span class="lbl">Following</span></div>
      </div>
    </div>
    ${userId !== "you" ? `<button type="button" class="btn" data-follow="${userId}">${isFollowing(social, userId) ? "Following" : "Follow"}</button>` : ""}`;
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "profile-grid";
  for (const p of getUserPosts(social, userId)) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "post-photo";
    tile.setAttribute("aria-label", `Open post: ${p.caption.slice(0, 60)}`);
    if (p.image) {
      tile.innerHTML = `<img src="${p.image}" alt="">`;
    } else {
      tile.style.background = "var(--board)";
      tile.textContent = "";
    }
    tile.addEventListener("click", () => openPostDialog(p));
    grid.appendChild(tile);
  }
  if (!grid.children.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>No posts yet.</p></div>`;
  }
  wrap.appendChild(grid);
  return wrap;
}

function openPostDialog(post) {
  import("./modal.js").then(({ openModal }) => {
    openModal((titleEl, bodyEl) => {
      titleEl.textContent = `${getUser(social, post.userId).name}, post`;
      bodyEl.appendChild(postCard(post));
      wirePostInteractions(bodyEl);
    });
  });
}

/* ---------- composer wiring ---------- */

function wireComposer(root) {
  const caption = root.querySelector("#composer-caption");
  const photo = root.querySelector("#composer-photo");
  const preview = root.querySelector("#composer-preview");
  const tagSearch = root.querySelector("#composer-tag-search");
  const tagResults = root.querySelector("#tag-results");
  const tagPicks = root.querySelector("#tag-picks");
  let imageDataUrl = null;
  composerTags = [];

  photo.addEventListener("change", async () => {
    const file = photo.files[0];
    if (!file) return;
    imageDataUrl = await downscaleImage(file);
    preview.hidden = false;
    preview.innerHTML = `<img src="${imageDataUrl}" alt="Photo preview">`;
  });

  const renderPicks = () => {
    tagPicks.innerHTML = "";
    for (const id of composerTags) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "badge";
      b.innerHTML = `${escapeHtml(tagLabel(id))} ✕`;
      b.setAttribute("aria-label", `Remove tag ${tagLabel(id)}`);
      b.addEventListener("click", () => {
        composerTags = composerTags.filter((t) => t !== id);
        renderPicks();
      });
      tagPicks.appendChild(b);
    }
  };

  let debounce;
  tagSearch.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = tagSearch.value.trim();
      if (q.length < 2 || !figIndex) { tagResults.hidden = true; return; }
      const matches = searchFigures([...figIndex.values()], q).slice(0, 8);
      tagResults.innerHTML = "";
      tagResults.hidden = !matches.length;
      tagSearch.setAttribute("aria-expanded", String(!!matches.length));
      for (const m of matches) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "option");
        b.textContent = `${m.name}${m.variant ? ` (${m.variant})` : ""}, ${m.waveSeries} ${m.year}`;
        b.addEventListener("click", () => {
          if (!composerTags.includes(m.id)) composerTags.push(m.id);
          renderPicks();
          tagSearch.value = "";
          tagResults.hidden = true;
          tagSearch.focus();
        });
        tagResults.appendChild(b);
      }
    }, 180);
  });

  root.querySelector("#composer-submit").addEventListener("click", () => {
    if (!caption.value.trim() && !imageDataUrl) {
      caption.focus();
      return;
    }
    createPost(social, { caption: caption.value, image: imageDataUrl, figureTags: composerTags });
    view.feedFilter = "all";
    render();
  });
}

/* Downscale uploads to a max 1080px JPEG dataURL, keeps localStorage small. */
function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1080;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

/* ---------- global interaction wiring (delegation) ---------- */

function wirePostInteractions(root) {
  root.addEventListener("click", (e) => {
    const like = e.target.closest("[data-like]");
    if (like) {
      const postId = like.dataset.like;
      const nowLiked = toggleLike(social, postId);
      like.setAttribute("aria-pressed", String(nowLiked));
      like.setAttribute("aria-label", `${nowLiked ? "Unlike" : "Like"} this post`);
      like.querySelector("span[aria-hidden]").textContent = nowLiked ? "♥" : "♡";
      like.querySelector("[data-like-count]").textContent = (social.likes[postId] ?? []).length;
      return;
    }
    const follow = e.target.closest("[data-follow]");
    if (follow) {
      const nowFollowing = toggleFollow(social, follow.dataset.follow);
      document.querySelectorAll(`[data-follow="${CSS.escape(follow.dataset.follow)}"]`)
        .forEach((b) => { b.textContent = nowFollowing ? "Following" : "Follow"; });
      return;
    }
    const profile = e.target.closest("[data-profile]");
    if (profile) {
      view = { ...view, tab: "profile", profileId: profile.dataset.profile };
      import("./modal.js").then(({ closeModal }) => closeModal());
      render();
      return;
    }
    const tag = e.target.closest("[data-fig-tag]");
    if (tag && figIndex) {
      const fig = figIndex.get(tag.dataset.figTag);
      if (fig) openFigureDialog(fig);
    }
  });

  root.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input[name=comment]");
    const comment = addComment(social, form.dataset.commentForm, "you", input.value);
    if (comment) {
      const div = document.createElement("div");
      div.className = "comment";
      div.innerHTML = `<strong>you</strong>${escapeHtml(comment.text)}`;
      form.before(div);
      input.value = "";
      const card = form.closest(".post");
      const count = card?.querySelector(".comment-count");
      if (count) {
        const n = (social.comments[form.dataset.commentForm] ?? []).length;
        count.textContent = `${n} comment${n === 1 ? "" : "s"}`;
      }
    }
  });
}

/* ---------- init ---------- */

function render() {
  renderTabs();
  els.main.innerHTML = "";
  const node = view.tab === "feed" ? renderFeed()
    : view.tab === "discover" ? renderDiscover()
    : renderProfile();
  els.main.appendChild(node);
  wirePostInteractions(els.main);
}

async function init() {
  try {
    social = await loadSocial();
    const { figures } = await loadData();
    figIndex = new Map(figures.map((f) => [f.id, f]));
    render();
  } catch (err) {
    console.error(err);
    els.main.innerHTML = `<div class="empty-state"><p>Could not load the community. Check your connection and reload.</p></div>`;
  }
}

init();
