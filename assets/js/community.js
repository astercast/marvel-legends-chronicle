/* Fan-social layer — client-side mock. Seed data hydrates localStorage once;
   everything after that (posts, likes, comments, follows) is local state. */
import { PATHS, STORE_KEYS } from "./config.js";
import { load, save } from "./store.js";

const DEFAULT_STATE = { seeded: false, profile: null, posts: [], likes: {}, follows: [], comments: {} };

export async function loadSocial() {
  let state = load(STORE_KEYS.social, DEFAULT_STATE);
  if (!state.seeded) {
    const res = await fetch(PATHS.communitySeed);
    if (!res.ok) throw new Error(`community.json: ${res.status}`);
    const seed = await res.json();
    state = {
      seeded: true,
      profile: { id: "you", name: "you", bio: "My Legends shelf.", avatarHue: 350, joined: new Date().toISOString().slice(0, 10) },
      users: Object.fromEntries(seed.users.map((u) => [u.id, u])),
      posts: seed.posts.map((p) => ({ ...p, art: artFor(p.id) })),
      likes: Object.fromEntries(seed.posts.map((p) => [p.id, p.likes ?? []])),
      follows: [],
      comments: Object.fromEntries(seed.posts.map((p) => [p.id, p.comments ?? []])),
    };
    save(STORE_KEYS.social, state);
  }
  return state;
}

export function persist(state) { save(STORE_KEYS.social, state); }

/* Deterministic gradient art for seed posts (no external images). */
function artFor(postId) {
  let h = 0;
  for (const c of postId) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { hue: h, hue2: (h + 40) % 360 };
}

export function getUser(state, userId) {
  if (userId === "you") return state.profile;
  return state.users[userId] ?? { id: userId, name: userId, bio: "", avatarHue: 200 };
}

export function isFollowing(state, userId) { return state.follows.includes(userId); }

export function toggleFollow(state, userId) {
  const i = state.follows.indexOf(userId);
  i >= 0 ? state.follows.splice(i, 1) : state.follows.push(userId);
  persist(state);
  return i < 0;
}

export function isLiked(state, postId) { return (state.likes[postId] ?? []).includes("you"); }

export function toggleLike(state, postId) {
  const likes = (state.likes[postId] ??= []);
  const i = likes.indexOf("you");
  i >= 0 ? likes.splice(i, 1) : likes.push("you");
  persist(state);
  return i < 0;
}

export function addComment(state, postId, author, text) {
  const clean = text.trim().slice(0, 500);
  if (!clean) return null;
  const comment = { author, text: clean, ts: new Date().toISOString() };
  (state.comments[postId] ??= []).push(comment);
  persist(state);
  return comment;
}

export function createPost(state, { caption, image, figureTags }) {
  const post = {
    id: `u-${Date.now()}`,
    userId: "you",
    caption: caption.trim().slice(0, 1000),
    figureTags: figureTags ?? [],
    ts: new Date().toISOString(),
    likes: [],
    comments: [],
    ...(image ? { image } : { art: artFor(`u-${Date.now()}`) }),
  };
  state.posts.unshift(post);
  state.likes[post.id] = [];
  state.comments[post.id] = [];
  persist(state);
  return post;
}

export function getFeed(state, filter) {
  const posts = [...state.posts].sort((a, b) => b.ts.localeCompare(a.ts));
  if (filter === "following") return posts.filter((p) => p.userId === "you" || state.follows.includes(p.userId));
  return posts;
}

export function getUserPosts(state, userId) {
  return state.posts
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.ts.localeCompare(a.ts));
}

export function extractHashtags(caption) {
  return [...caption.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase());
}

export function searchPosts(state, query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.posts.filter((p) => p.caption.toLowerCase().includes(q));
}

export function statsFor(state, userId) {
  const posts = getUserPosts(state, userId);
  const followers = userId === "you"
    ? state.follows.length // mock: your follower count mirrors follows for demo symmetry
    : seedFollowers(userId);
  return { posts: posts.length, followers, following: userId === "you" ? state.follows.length : 0 };
}

function seedFollowers(userId) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 40 + h;
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
