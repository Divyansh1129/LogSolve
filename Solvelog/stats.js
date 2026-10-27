// Vercel serverless function: fetches LeetCode stats server-side (browsers are blocked by CORS).
const QUERY = `query($u:String!){
  matchedUser(username:$u){
    username
    profile{ realName userAvatar ranking }
    submitStatsGlobal{ acSubmissionNum{ difficulty count } }
    userCalendar{ streak totalActiveDays }
  }
  recentAcSubmissionList(username:$u, limit:1){ title titleSlug timestamp }
  userContestRanking(username:$u){ rating attendedContestsCount topPercentage }
}`;

async function one(u) {
  try {
    const r = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query: QUERY, variables: { u } }),
    });
    const { data } = await r.json();
    const m = data && data.matchedUser;
    if (!m) return { username: u, ok: false };
    const n = Object.fromEntries(m.submitStatsGlobal.acSubmissionNum.map(x => [x.difficulty, x.count]));
    const last = (data.recentAcSubmissionList || [])[0];
    const c = data.userContestRanking;
    return {
      username: m.username, ok: true,
      name: m.profile.realName || m.username, avatar: m.profile.userAvatar, ranking: m.profile.ranking,
      easy: n.Easy || 0, medium: n.Medium || 0, hard: n.Hard || 0, total: n.All || 0,
      streak: m.userCalendar ? m.userCalendar.streak : 0,
      activeDays: m.userCalendar ? m.userCalendar.totalActiveDays : 0,
      contest: c ? { rating: Math.round(c.rating), attended: c.attendedContestsCount, top: c.topPercentage } : null,
      last: last ? { title: last.title, slug: last.titleSlug, ts: Number(last.timestamp) } : null,
    };
  } catch (e) { return { username: u, ok: false }; }
}

module.exports = async (req, res) => {
  const users = String(req.query.u || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const out = await Promise.all(users.map(one));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json(out);
};
