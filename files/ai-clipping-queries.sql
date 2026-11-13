-- ===== 01_activation_funnel.sql =====
-- Metric 1: Activation funnel
-- Do users who submit a stream actually get clips, and do they use them?
-- Tables: streams, clips, clip_downloads, clip_shares

WITH submitters AS (
    SELECT user_id, COUNT(*) AS total_streams
    FROM streams
    GROUP BY user_id
),
clip_users AS (
    SELECT DISTINCT user_id FROM clips
),
engaged_users AS (
    SELECT user_id FROM clip_downloads
    UNION
    SELECT user_id FROM clip_shares
)
SELECT
    COUNT(s.user_id) AS users_submitted_stream,
    COUNT(c.user_id) AS users_got_clip,
    COUNT(e.user_id) AS users_download_or_share,
    CAST(100.0 * COUNT(c.user_id) / COUNT(s.user_id) AS DECIMAL(5,2)) AS pct_got_clip,
    CAST(100.0 * COUNT(e.user_id) / COUNT(s.user_id) AS DECIMAL(5,2)) AS pct_activated
FROM submitters s
LEFT JOIN clip_users    c ON c.user_id = s.user_id
LEFT JOIN engaged_users e ON e.user_id = s.user_id;

-- ===== 02_clip_engagement_by_type.sql =====
-- Metric 2: Download and share rate per clip type
-- Tables: clips, clip_downloads, clip_shares

WITH dl AS (SELECT DISTINCT clip_id FROM clip_downloads),
     sh AS (SELECT DISTINCT clip_id FROM clip_shares)
SELECT
    c.clip_type_id,
    CASE c.clip_type_id
        WHEN 1 THEN 'Horizontal AI highlight'
        WHEN 2 THEN 'Convert to TikTok (CTT)'
        WHEN 3 THEN 'Trimmed'
        WHEN 5 THEN 'Eventful (stream statistic)'
        WHEN 6 THEN 'Weekly montage'
        WHEN 7 THEN 'Uploaded from local'
        WHEN 8 THEN 'Vertical YouTube highlight'
        ELSE 'Unknown'
    END AS clip_type,
    COUNT(*) AS total_clips,
    COUNT(dl.clip_id) AS clips_downloaded,
    COUNT(sh.clip_id) AS clips_shared,
    CAST(100.0 * COUNT(dl.clip_id) / COUNT(*) AS DECIMAL(5,2)) AS download_rate_pct,
    CAST(100.0 * COUNT(sh.clip_id) / COUNT(*) AS DECIMAL(5,2)) AS share_rate_pct
FROM clips c
LEFT JOIN dl ON dl.clip_id = c.id
LEFT JOIN sh ON sh.clip_id = c.id
GROUP BY c.clip_type_id
ORDER BY total_clips DESC;

-- ===== 03_top_engaging_events.sql =====
-- Metric 3: Top engaging events
-- Which in-game moments get downloaded or shared the most?
-- event_name is normalized because it is written in several ways
-- (for example 'Multi kill', 'Multi-kill', 'Multi Kill', 'multi_kill').
-- Tables: clips, clip_downloads, clip_shares

WITH dl AS (SELECT DISTINCT clip_id FROM clip_downloads),
     sh AS (SELECT DISTINCT clip_id FROM clip_shares),
     c AS (
        SELECT id, game_name,
               LOWER(LTRIM(RTRIM(REPLACE(REPLACE(event_name, '-', ' '), '_', ' ')))) AS event_clean
        FROM clips
        WHERE event_name IS NOT NULL
     )
SELECT TOP 15
    c.event_clean                                                 AS event_name,
    COUNT(*)                                                      AS total_clips,
    COUNT(dl.clip_id)                                             AS clips_downloaded,
    COUNT(sh.clip_id)                                             AS clips_shared,
    CAST(100.0 * COUNT(dl.clip_id) / COUNT(*) AS DECIMAL(5,2))    AS download_rate_pct,
    CAST(100.0 * COUNT(sh.clip_id) / COUNT(*) AS DECIMAL(5,2))    AS share_rate_pct
FROM c
LEFT JOIN dl ON dl.clip_id = c.id
LEFT JOIN sh ON sh.clip_id = c.id
GROUP BY c.event_clean
HAVING COUNT(*) >= 1000          -- skip events with small samples
ORDER BY download_rate_pct DESC;

-- ===== 04_premium_vs_free.sql =====
-- Metric 4: Premium conversion and premium vs free behaviour
-- Tables: streams, subscriptions, clip_downloads, clip_shares

WITH user_activity AS (
    SELECT user_id,
           COUNT(*) AS streams,
           SUM(CAST(duration AS BIGINT)) / 3600000.0 AS stream_hours
    FROM streams
    GROUP BY user_id
),
premium_users AS (SELECT DISTINCT user_id FROM subscriptions),
dl AS (SELECT user_id, COUNT(*) AS downloads FROM clip_downloads GROUP BY user_id),
sh AS (SELECT user_id, COUNT(DISTINCT clip_id) AS shares FROM clip_shares GROUP BY user_id)
SELECT
    CASE WHEN p.user_id IS NULL THEN 'Free' ELSE 'Premium' END AS segment,
    COUNT(*) AS users,
    CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS pct_of_users,
    CAST(AVG(1.0 * u.streams) AS DECIMAL(10,2)) AS avg_streams_per_user,
    CAST(AVG(u.stream_hours) AS DECIMAL(10,2)) AS avg_stream_hours,
    CAST(AVG(1.0 * ISNULL(d.downloads, 0)) AS DECIMAL(10,2)) AS avg_downloads_per_user,
    CAST(AVG(1.0 * ISNULL(s.shares, 0)) AS DECIMAL(10,2)) AS avg_shares_per_user,
    CAST(100.0 * COUNT(d.user_id) / COUNT(*) AS DECIMAL(5,2)) AS pct_users_downloading
FROM user_activity u
LEFT JOIN premium_users p ON p.user_id = u.user_id
LEFT JOIN dl d ON d.user_id = u.user_id
LEFT JOIN sh s ON s.user_id = u.user_id
GROUP BY CASE WHEN p.user_id IS NULL THEN 'Free' ELSE 'Premium' END;

-- ===== 05_premium_churn.sql =====
-- Metric 5: Premium churn and usage during the subscription
-- Tables: subscriptions, streams

WITH subs AS (
    SELECT
        p.user_id, p.starts_at, p.ends_at, p.canceled_at,
        CASE
            WHEN DATEDIFF(day, p.starts_at, p.ends_at) <= 35  THEN '1. Monthly'
            WHEN DATEDIFF(day, p.starts_at, p.ends_at) <= 200 THEN '2. 2-6 months'
            ELSE '3. >6 months / annual'
        END         AS plan_length,
        COUNT(g.id) AS streams_during_premium
    FROM subscriptions p
    LEFT JOIN streams g
           ON g.user_id = p.user_id
          AND g.submitted_at >= p.starts_at
          AND g.submitted_at <  DATEADD(day, 1, p.ends_at)
    WHERE p.starts_at >= '2023-06-01'      -- stream data starts here
    GROUP BY p.user_id, p.starts_at, p.ends_at, p.canceled_at
)
SELECT
    plan_length,
    COUNT(*) AS subscriptions,
    SUM(CASE WHEN canceled_at IS NOT NULL THEN 1 ELSE 0 END) AS canceled,
    CAST(100.0 * SUM(CASE WHEN canceled_at IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS cancel_rate_pct,
    AVG(CASE WHEN canceled_at IS NOT NULL THEN DATEDIFF(day, starts_at, canceled_at) END) AS avg_days_to_cancel,
    CAST(AVG(1.0 * streams_during_premium) AS DECIMAL(10,2)) AS avg_streams_during_premium,
    CAST(100.0 * SUM(CASE WHEN streams_during_premium = 0 THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS pct_zero_usage
FROM subs
GROUP BY plan_length
ORDER BY plan_length;

-- ===== 06_warzone_event_engagement.sql =====
-- Task 2 support query: which Warzone moments get downloaded and shared?
-- Only AI-generated clips (type 1 and 5) are included.
-- Tables: clips, clip_downloads, clip_shares

WITH dl AS (SELECT DISTINCT clip_id FROM clip_downloads),
     sh AS (SELECT DISTINCT clip_id FROM clip_shares)
SELECT
    LOWER(REPLACE(c.event_name, '-', ' ')) AS event_name,
    COUNT(*) AS total_clips,
    CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS share_of_clips_pct,
    COUNT(dl.clip_id) AS clips_downloaded,
    COUNT(sh.clip_id) AS clips_shared,
    CAST(100.0 * COUNT(dl.clip_id) / COUNT(*) AS DECIMAL(5,2)) AS download_rate_pct,
    AVG(c.duration) AS avg_duration_sec
FROM clips c
LEFT JOIN dl ON dl.clip_id = c.id
LEFT JOIN sh ON sh.clip_id = c.id
WHERE c.game_name = 'Warzone'
  AND c.clip_type_id IN (1, 5)
  AND c.event_name IS NOT NULL
GROUP BY LOWER(REPLACE(c.event_name, '-', ' '))
HAVING COUNT(*) >= 200
ORDER BY download_rate_pct DESC;

