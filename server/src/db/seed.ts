import { db } from './init';

console.log('Seeding database...');

// Seed KOLs
const kols = [
  {
    name: '李自然',
    channel_url: 'youtube.com/@liziran',
    platform: 'youtube',
    tags: JSON.stringify(['AI', '科技', '评测']),
    fetch_policy: JSON.stringify({ cron: '0 3 * * *', max_videos: 20 }),
    active: 1,
    next_run: '今日 03:00'
  },
  {
    name: '硅谷徐',
    channel_url: 'youtube.com/@guiguxu',
    platform: 'youtube',
    tags: JSON.stringify(['创业', '硅谷', '大模型']),
    fetch_policy: JSON.stringify({ cron: '0 4 * * *', max_videos: 10 }),
    active: 1,
    next_run: '明日 03:00'
  },
  {
    name: 'TESTV',
    channel_url: 'youtube.com/@testv',
    platform: 'youtube',
    tags: JSON.stringify(['数码', '开箱']),
    fetch_policy: JSON.stringify({}),
    active: 0
  }
];

const insertKol = db.prepare(`
  INSERT INTO kols (name, channel_url, platform, tags, fetch_policy, active, next_run)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

kols.forEach(kol => {
  try {
    insertKol.run(kol.name, kol.channel_url, kol.platform, kol.tags, kol.fetch_policy, kol.active, kol.next_run);
    console.log(`Inserted KOL: ${kol.name}`);
  } catch (err) {
    console.log(`KOL ${kol.name} already exists, skipping`);
  }
});

// Get KOL IDs
const liziranId = (db.prepare('SELECT id FROM kols WHERE name = ?').get('李自然') as any).id;
const guiguxuId = (db.prepare('SELECT id FROM kols WHERE name = ?').get('硅谷徐') as any).id;

// Seed Videos
const videos = [
  {
    id: 'video_001',
    kol_id: liziranId,
    title: '2025年AI预测',
    duration: 1200,
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=600&h=400',
    published_at: '2024-05-20T10:00:00Z',
    subtitles: JSON.stringify([
      { start: 0, end: 3.5, text: 'Hello everyone' },
      { start: 3.5, end: 7.2, text: 'Today we will talk about AI' }
    ])
  },
  {
    id: 'video_002',
    kol_id: guiguxuId,
    title: '深入解析 GPT-5',
    duration: 1500,
    thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600&h=400',
    published_at: '2024-05-19T10:00:00Z',
    subtitles: JSON.stringify([
      { start: 0, end: 3.5, text: 'Welcome back' },
      { start: 3.5, end: 7.2, text: 'Let dive into GPT-5' }
    ])
  },
  {
    id: 'video_003',
    kol_id: liziranId,
    title: '自媒体实战分享',
    duration: 1800,
    thumbnail: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=600&h=400',
    published_at: '2024-05-18T10:00:00Z',
    subtitles: JSON.stringify([
      { start: 0, end: 3.5, text: 'Hey guys' },
      { start: 3.5, end: 7.2, text: 'Today sharing content creation tips' }
    ])
  }
];

const insertVideo = db.prepare(`
  INSERT INTO videos (id, kol_id, title, duration, thumbnail, published_at, subtitles)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

videos.forEach(video => {
  try {
    insertVideo.run(video.id, video.kol_id, video.title, video.duration, video.thumbnail, video.published_at, video.subtitles);
    console.log(`Inserted Video: ${video.title}`);
  } catch (err) {
    console.log(`Video ${video.id} already exists, skipping`);
  }
});

// Seed Clips
const clips = [
  {
    video_id: 'video_001',
    kol_name: '李自然',
    start_sec: 192,
    end_sec: 300,
    title: 'AI 取代哪些职业',
    summary: '探讨了 AI 在未来5年内最可能替代的职业类型，包括数据标注、基础文案等，同时指出创意类工作短期仍有优势。',
    keywords: JSON.stringify(['AI', '职业替代', '未来']),
    topic_category: '观点',
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    video_id: 'video_002',
    kol_name: '硅谷徐',
    start_sec: 344,
    end_sec: 420,
    title: 'GPT-5 核心突破点',
    summary: '从技术和商业化角度深度剖析了 GPT-5 可能带来的改变，特别是其在多模态理解和长上下文方面的跃升。',
    keywords: JSON.stringify(['GPT', '大模型', '技术']),
    topic_category: '分析',
    thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600&h=400'
  },
  {
    video_id: 'video_003',
    kol_name: '李自然',
    start_sec: 483,
    end_sec: 612,
    title: '如何做播客选题',
    summary: '分享了自己做播客的选题思路，如何抓住热点同时保持长期内容价值，以及一套行之有效的爆款选题模板。',
    keywords: JSON.stringify(['播客', '内容', '运营']),
    topic_category: '教程',
    thumbnail: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=600&h=400'
  }
];

const insertClip = db.prepare(`
  INSERT INTO clips (video_id, kol_name, start_sec, end_sec, title, summary, keywords, topic_category, thumbnail)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

clips.forEach(clip => {
  try {
    insertClip.run(
      clip.video_id,
      clip.kol_name,
      clip.start_sec,
      clip.end_sec,
      clip.title,
      clip.summary,
      clip.keywords,
      clip.topic_category,
      clip.thumbnail
    );
    console.log(`Inserted Clip: ${clip.title}`);
  } catch (err) {
    console.log(`Clip already exists, skipping`);
  }
});

// Seed Jobs
const jobs = [
  {
    kol_id: liziranId,
    video_id: 'video_001',
    stage: 'clip',
    status: 'running',
    progress: 62,
    started_at: new Date().toISOString()
  },
  {
    kol_id: liziranId,
    video_id: 'video_001',
    stage: 'index',
    status: 'success',
    progress: 100,
    started_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3000000).toISOString()
  },
  {
    kol_id: liziranId,
    video_id: 'video_001',
    stage: 'clip',
    status: 'success',
    progress: 100,
    started_at: new Date(Date.now() - 4000000).toISOString(),
    completed_at: new Date(Date.now() - 3500000).toISOString()
  },
  {
    kol_id: liziranId,
    video_id: 'video_001',
    stage: 'process',
    status: 'success',
    progress: 100,
    started_at: new Date(Date.now() - 5000000).toISOString(),
    completed_at: new Date(Date.now() - 4500000).toISOString()
  },
  {
    kol_id: guiguxuId,
    video_id: 'video_002',
    stage: 'crawl',
    status: 'failed',
    progress: 12,
    error_message: 'Failed to fetch video metadata',
    started_at: new Date(Date.now() - 6000000).toISOString(),
    completed_at: new Date(Date.now() - 5900000).toISOString()
  }
];

const insertJob = db.prepare(`
  INSERT INTO jobs (kol_id, video_id, stage, status, progress, error_message, started_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

jobs.forEach(job => {
  try {
    insertJob.run(
      job.kol_id,
      job.video_id,
      job.stage,
      job.status,
      job.progress,
      job.error_message,
      job.started_at,
      job.completed_at
    );
    console.log(`Inserted Job: ${job.stage} - ${job.status}`);
  } catch (err) {
    console.log(`Job already exists, skipping`);
  }
});

console.log('Database seeded successfully!');
