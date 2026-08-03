import { useState, useEffect, useRef } from 'react';

/**
 * Filovita 起動アニメーション(改訂版)
 *
 * 演出の順番:
 *   1. 留め金が外れる(カチッ)
 *   2. 表紙が横にずれて開く(回転ではなくスライド)
 *   3. ロゴがインクのように紙に染み出す
 *
 * 初回は 1.6 秒のフル演出、2回目以降は 0.5 秒の短縮版になる
 * (localStorage の 'filovita_visited' で判定)
 *
 * 事前準備:
 *   index.html の <head> に以下を追加してください
 *   <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400&display=swap" rel="stylesheet">
 *
 *   フォントについて:
 *   ウィーン分離派のポスター文字(コロマン・モーザーらのレタリング)に近い、
 *   幾何学的で細身の Jost を採用。執事のシルエット(直線的・フォーマル)と
 *   同じ幾何学的な語彙を共有しており、ロゴ全体で一貫したデザイン言語になる。
 */
export default function NotebookOpen({ onDone }) {
  const isFirstVisit = useRef(
    typeof window !== 'undefined' && !window.localStorage.getItem('filovita_visited')
  );
  const claspMs = isFirstVisit.current ? 350 : 150;
  const openMs = isFirstVisit.current ? 900 : 250;
  const inkMs = isFirstVisit.current ? 900 : 200;

  const [claspOff, setClaspOff] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setClaspOff(true), 50);
    const t2 = setTimeout(() => setCoverOpen(true), 50 + claspMs);
    const t3 = setTimeout(() => setShowLogo(true), 50 + claspMs + openMs * 0.4);
    const t4 = setTimeout(() => {
      window.localStorage.setItem('filovita_visited', '1');
      onDone && onDone();
    }, 50 + claspMs + openMs + inkMs * 0.5);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [claspMs, openMs, inkMs, onDone]);

  return (
    <div style={styles.wrap}>
      <div style={styles.stage}>
        {/* 中のページ(紙の質感) */}
        <div style={styles.page}>
          <svg width="70%" viewBox="0 0 320 60" style={{ marginBottom: 8 }}>
            <g fill="none" stroke="#9C7A3C" strokeWidth="1.2">
              <path d="M30 40 Q 20 20 35 12 Q 50 5 55 20 Q 58 32 45 35" />
              <path d="M290 40 Q 300 20 285 12 Q 270 5 265 20 Q 262 32 275 35" />
            </g>
            <g fill="#9C7A3C">
              <circle cx="35" cy="12" r="2.3" />
              <circle cx="285" cy="12" r="2.3" />
            </g>
          </svg>
          <div
            style={{
              ...styles.logo,
              opacity: showLogo ? 1 : 0,
              filter: showLogo ? 'blur(0px)' : 'blur(4px)',
              transition: `opacity ${inkMs}ms ease, filter ${inkMs}ms ease`,
            }}
          >
            FILOVITA
          </div>
          <div
            style={{
              ...styles.tagline,
              opacity: showLogo ? 1 : 0,
              transition: `opacity ${inkMs}ms ease ${inkMs * 0.3}ms`,
            }}
          >
            今日の暮らしを開く
          </div>
        </div>

        {/* 表紙(横にずれて開く) */}
        <div
          style={{
            ...styles.cover,
            transform: coverOpen ? 'translateX(-100%)' : 'translateX(0)',
            boxShadow: coverOpen ? '0 0 0 rgba(0,0,0,0)' : '2px 0 8px rgba(0,0,0,0.25)',
            transition: `transform ${openMs}ms ease-in-out, box-shadow ${openMs}ms ease`,
          }}
        >
          <div style={styles.coverBorder} />
          {/* 留め金 */}
          <div
            style={{
              ...styles.clasp,
              opacity: claspOff ? 0 : 1,
              transform: claspOff ? 'translateY(-50%) scale(0.6)' : 'translateY(-50%) scale(1)',
              transition: `opacity ${claspMs}ms ease, transform ${claspMs}ms ease`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    background: '#F6F1E7',
  },
  stage: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    aspectRatio: '3 / 4',
    overflow: 'hidden',
    borderRadius: 8,
  },
  page: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 40%), #F6F1E7',
    border: '0.5px solid #E4DCCB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: "'Jost', sans-serif",
    fontWeight: 400,
    letterSpacing: '0.1em',
    fontSize: 32,
    color: '#8A6E4A',
    textShadow: '0 1px 0 rgba(255,255,255,0.6), 0 -1px 1px rgba(0,0,0,0.2)',
  },
  tagline: {
    fontSize: 11,
    color: '#B4A588',
    letterSpacing: '0.1em',
    marginTop: 8,
  },
  cover: {
    position: 'absolute',
    inset: 0,
    background: '#5A3A24',
    transformOrigin: 'left center',
  },
  clasp: {
    position: 'absolute',
    top: '50%',
    right: 16,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#9C7A3C',
  },
  coverBorder: {
    position: 'absolute',
    inset: 12,
    border: '1px solid rgba(156,122,60,0.53)',
    borderRadius: 4,
  },
};
