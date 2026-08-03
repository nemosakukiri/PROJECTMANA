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
 * ロゴについて:
 *   執事のシルエット＋「FILOVITA」の文字は、フォントが入っていない環境
 *   でも同じ見た目になるよう、あらかじめアウトライン化したSVGパスとして
 *   埋め込んである(2026-08-03)。外部フォントの読み込みは不要。
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
          {/* 執事のシルエット＋FILOVITAのロゴマーク(2026-08-03、麻奈さんから受け取ったSVG) */}
          <svg
            width="66%" viewBox="0 0 400 220"
            style={{
              opacity: showLogo ? 1 : 0,
              filter: showLogo ? 'blur(0px)' : 'blur(4px)',
              transition: `opacity ${inkMs}ms ease, filter ${inkMs}ms ease`,
            }}
          >
            <g transform="translate(200,90)">
              <rect x="-18" y="-34" width="36" height="12" rx="2" fill="#5A3A24" />
              <rect x="-22" y="-25" width="44" height="4" rx="2" fill="#5A3A24" />
              <circle cx="0" cy="-2" r="17" fill="#E8CBB0" />
              <path d="M -19 17 Q -19 -6 0 -6 Q 19 -6 19 17 L 19 29 L -19 29 Z" fill="#5A3A24" />
              <rect x="-5" y="6" width="10" height="13" fill="#F6F1E7" />
              <path d="M -2.5 7.5 L 2.5 7.5 L 0 15 Z" fill="#9C7A3C" />
            </g>
            {/* 「FILOVITA」の文字をアウトライン化したパス。フォントが
                入っていない環境でも同じ見た目で表示されるように
                (2026-08-03、麻奈さんからの指摘を受けてtext要素から変更)。 */}
            <path d="M78 700H464V594H194V419H454V316H194V0H78Z" transform="translate(106.96,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M78 700H197V0H78Z" transform="translate(130.16,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M78 700H196V106H474V0H78Z" transform="translate(143.51999999999998,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M38 350Q38 428 65.5 494.5Q93 561 142.0 609.5Q191 658 257.0 685.0Q323 712 401 712Q479 712 545.5 685.0Q612 658 661.5 609.5Q711 561 738.0 494.5Q765 428 765 350Q765 272 738.0 205.5Q711 139 662.0 89.5Q613 40 546.5 12.5Q480 -15 401 -15Q322 -15 256.0 12.5Q190 40 141.0 89.5Q92 139 65.0 205.5Q38 272 38 350ZM164 350Q164 278 194.5 221.5Q225 165 278.5 133.0Q332 101 401 101Q471 101 524.5 133.0Q578 165 608.5 221.5Q639 278 639 350Q639 422 608.5 478.5Q578 535 524.5 567.0Q471 599 401 599Q332 599 278.5 567.0Q225 535 194.5 478.5Q164 422 164 350Z" transform="translate(165.16,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M345 208 551 700H687L345 -38L3 700H139Z" transform="translate(199.64,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M78 700H197V0H78Z" transform="translate(229.6,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M8 591V700H496V591H312V0H192V591Z" transform="translate(242.95999999999998,155) scale(0.04,-0.04)" fill="#8A6E4A" />
            <path d="M554 0 474 180H217L137 0H3L345 738L687 0ZM345 502 250 280H440Z" transform="translate(265.48,155) scale(0.04,-0.04)" fill="#8A6E4A" />
          </svg>
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
