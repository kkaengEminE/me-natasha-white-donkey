import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { initStage1 } from '../stages/stage1';
import { initStage2 } from '../stages/stage2';
import { initStage3 } from '../stages/stage3';
import { initStage4 } from '../stages/stage4';
import { initStage5 } from '../stages/stage5';
import AdminPanel from './AdminPanel';

// 배포 시에는 ADMIN_ENABLED를 false로 바꾸세요 (관리자 버튼이 사라집니다)
const ADMIN_ENABLED = true;

const STAGE_NAMES: Record<number, string> = {
  1: '눈 내리는 밤',
  2: '나타샤를 기다리며',
  3: '세상을 버리고',
  4: '흰 눈길과 초인',
  5: '나타샤와 흰 당나귀',
};

declare global {
  interface Window {
    gameStartS1?: () => void;
    gameStartS2?: () => void;
    gameStartS3?: () => void;
    gameStartS4?: () => void;
    gameStartS5?: () => void;
    initStage1?: () => void;
    initStage2?: () => void;
    initStage3?: () => void;
    initStage4?: () => void;
    initStage5?: () => void;
    onStageClear?: (stageNum: number) => void;
    onGameComplete?: () => void;
  }
}

export default function GameScreen() {
  const navigate = useNavigate();
  const [currentStage, setCurrentStage] = useState(1);
  const [interludeVisible, setInterludeVisible] = useState(false);
  const [transitionBlack, setTransitionBlack] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const mountedRef = useRef(false);

  // Initialize all stages once
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Initialize all stage IIFEs so their event listeners and DOM hooks register
    initStage1();
    initStage2();
    initStage3();
    initStage4();
    initStage5();

    // Wire up auto-advance handler
    window.onStageClear = (stageNum: number) => {
      if (stageNum < 5) {
        advanceToStage(stageNum + 1);
      }
    };

    window.onGameComplete = () => {
      // Stage 5 ending screen handles itself (shows ending poem + restart button)
    };

    // Initial mount: activate stage 1
    activateStage(1);

    // Allow ESC to return to menu
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate({ to: '/' });
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function activateStage(n: number) {
    setCurrentStage(n);

    // Hide all, show target
    document.querySelectorAll<HTMLDivElement>('.sw').forEach((el) => {
      el.classList.remove('active');
    });
    const sw = document.getElementById('sw' + n);
    if (sw) {
      sw.classList.add('active');

      // Auto-dismiss the stage title screen (user already clicked
      // 시작하기 in the main menu — skip the redundant second title)
      const ts = sw.querySelector<HTMLDivElement>('[id$="title_screen"]');
      if (ts) {
        ts.style.display = 'none';
      }
    }

    // Interlude
    setInterludeVisible(true);
    setTimeout(() => {
      setTransitionBlack(false);
      setTimeout(() => setInterludeVisible(false), 1800);
    }, 400);

    // Auto-start the stage game loop after the interlude finishes
    // (total ~2.2s: 400ms fade + 1800ms interlude display)
    setTimeout(() => {
      const startFn = (window as any)['gameStartS' + n];
      if (typeof startFn === 'function') startFn();
    }, 2300);
  }

  function advanceToStage(n: number) {
    setTransitionBlack(true);
    setTimeout(() => {
      activateStage(n);
    }, 1200);
  }

  return (
    <>
      <div
        id="screen-transition"
        className={transitionBlack ? 'black' : ''}
      />
      <div
        id="stage-interlude"
        className={interludeVisible ? 'show' : ''}
      >
        <div className="si-label">Stage 0{currentStage}</div>
        <div className="si-title">{STAGE_NAMES[currentStage]}</div>
      </div>

      <button
        id="stage-restart-btn"
        onClick={() => {
          const fn = (window as any)['gameStartS' + currentStage];
          if (typeof fn === 'function') fn();
        }}
      >
        ↻ 스테이지 다시 시작
      </button>
      {ADMIN_ENABLED && (
        <button id="admin-toggle" onClick={() => setAdminOpen(true)}>
          ⚙ 관리자 모드
        </button>
      )}
      {adminOpen && (
        <AdminPanel stage={currentStage} onClose={() => setAdminOpen(false)} />
      )}

      {/* ═══ STAGE 1 ═══ */}
      <div className="sw" id="sw1">
        <svg
          id="s1cursor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="10" r="4" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="rgba(200,230,255,0.3)"
            strokeWidth="0.5"
          />
        </svg>
        <canvas id="s1snow_canvas" />
        <canvas id="s1game_canvas" />
        <div id="s1hud">
          <div id="s1poem_strip">
            <div className="poem-line" id="s1line1">
              가난한 내가
            </div>
            <div className="poem-line" id="s1line2">
              아름다운 나타샤를 사랑해서
            </div>
            <div className="poem-line" id="s1line3">
              오늘밤은 푹푹 눈이 나린다
            </div>
          </div>
          <div id="s1stage_label">Stage 1 · 눈 내리는 밤</div>
          <div id="s1fragment_hud">
            <div className="frag-dot" id="s1dot0" />
            <div className="frag-dot" id="s1dot1" />
            <div className="frag-dot" id="s1dot2" />
          </div>
          <div id="controls-hint">
            방향키 / WASD · 이동
            <br />
            마우스 · 탐색
          </div>
          <div id="word-popup" />
        </div>
        <div id="s1stage_clear">
          <div className="clear-poem">
            가난한 내가
            <br />
            아름다운 나타샤를 사랑해서
            <br />
            오늘밤은 푹푹 눈이 나린다
          </div>
          <div className="poet-note">— 백석, 1938</div>
        </div>
        <div id="s1title_screen">
          <div className="title-label">POEM GAME · 제1편</div>
          <div className="title-main">
            나와 나타샤와
            <br />흰 당나귀
          </div>
          <div className="title-sub">스테이지 1 — 눈 내리는 밤</div>
          <div className="title-author">백석 (白石)</div>
        </div>
      </div>

      {/* ═══ STAGE 2 ═══ */}
      <div className="sw" id="sw2">
        <svg
          id="s2cursor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
        >
          <circle cx="9" cy="9" r="3" fill="rgba(230,190,100,0.8)" />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="rgba(200,160,80,0.3)"
            strokeWidth="0.5"
          />
        </svg>
        <canvas id="s2bg_canvas" />
        <canvas id="s2game_canvas" />
        <div id="s2hud">
          <div id="s2poem_strip">
            <div className="poem-line" id="s2l1">
              나타샤를 사랑은 하고
            </div>
            <div className="poem-line" id="s2l2">
              눈은 푹푹 날리고
            </div>
            <div className="poem-line" id="s2l3">
              나는 혼자 쓸쓸히 앉어 소주를 마신다
            </div>
            <div className="poem-line" id="s2l4">
              나타샤와 나는
            </div>
            <div className="poem-line" id="s2l5">
              눈이 푹푹 쌓이는 밤 흰 당나귀 타고
            </div>
            <div className="poem-line" id="s2l6">
              산골로 가자 출출이 우는 깊은 산골로 가자
            </div>
          </div>
          <div id="s2stage_label">Stage 2 · 나타샤를 기다리며</div>
          <div id="s2fragment_hud">
            <div className="frag-dot" id="s2d0" />
            <div className="frag-dot" id="s2d1" />
            <div className="frag-dot" id="s2d2" />
            <div className="frag-dot" id="s2d3" />
            <div className="frag-dot" id="s2d4" />
            <div className="frag-dot" id="s2d5" />
          </div>
          <div id="s2ctrl">
            방향키 이동 · ↑ 점프
            <br />E · 오브젝트 조사
          </div>
          <div id="s2thought" />
          <div id="s2word_flash" />
          <div id="s2room_caption" />
        </div>
        <div id="s2stage_clear">
          <div className="clear-poem">
            나타샤를 사랑은 하고
            <br />
            눈은 푹푹 날리고
            <br />
            나는 혼자 쓸쓸히 앉어 소주를 마신다
            <br />
            나타샤와 나는
            <br />
            눈이 푹푹 쌓이는 밤 흰 당나귀 타고
            <br />
            산골로 가자 출출이 우는 깊은 산골로 가자
          </div>
          <div className="poet-note">— 백석, 1938</div>
        </div>
        <div id="s2title_screen">
          <div className="t-tag">POEM GAME · 제1편</div>
          <div className="t-main">
            나타샤를
            <br />기다리며
          </div>
          <div className="t-sub">스테이지 2 — 주막의 밤</div>
        </div>
        <div id="s2room_transition" />
      </div>

      {/* ═══ STAGE 3 ═══ */}
      <div className="sw" id="sw3">
        <svg
          id="s3cursor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
        >
          <circle cx="9" cy="9" r="3" fill="rgba(200,235,150,0.85)" />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="rgba(170,215,110,0.3)"
            strokeWidth="0.5"
          />
        </svg>
        <canvas id="s3game_canvas" />
        <div id="s3hud">
          <div id="s3poem_strip">
            <div className="poem-line" id="s3l0">
              산골로 가는 것은 세상한테 지는 것이 아니다
            </div>
            <div className="poem-line" id="s3l1">
              세상 같은 건 더러워 버리는 것이다
            </div>
          </div>
          <div id="s3stage_label">Stage 3 · 세상을 버리고</div>
          <div id="s3fragment_hud">
            <div className="frag-dot" id="s3d0" />
            <div className="frag-dot" id="s3d1" />
            <div className="frag-dot" id="s3d2" />
            <div className="frag-dot" id="s3d3" />
            <div className="frag-dot" id="s3d4" />
          </div>
          <div id="s3ctrl">
            방향키 이동 · ↑ 점프
            <br />R · 당나귀 탑승/하차
            <br />E · 조사
          </div>
          <div id="s3mount_hint">[ R ] 당나귀에 올라타기</div>
          <div id="s3mounted_indicator">🫏 당나귀를 타고 있다</div>
          <div id="s3word_flash" />
          <div id="s3thought" />
          <div id="s3room_caption" />
        </div>
        <div id="s3stage_clear">
          <div className="clear-poem">
            산골로 가는 것은
            <br />
            세상한테 지는 것이 아니다
            <br />
            세상 같은 건<br />
            더러워 버리는 것이다
          </div>
          <div className="poet-note">— 백석, 1938</div>
        </div>
        <div id="s3title_screen">
          <div className="t-tag">POEM GAME · 제1편</div>
          <div className="t-main">
            세상을
            <br />버리고
          </div>
          <div className="t-sub">스테이지 3 — 고갯길</div>
          <div className="t-verse">
            산골로 가는 것은 세상한테 지는 것이 아니다
            <br />
            세상 같은 건 더러워 버리는 것이다
          </div>
        </div>
        <div id="s3room_transition" />
      </div>

      {/* ═══ STAGE 4 ═══ */}
      <div className="sw" id="sw4">
        <svg
          id="s4cursor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
        >
          <circle cx="9" cy="9" r="3" fill="rgba(170,195,255,0.8)" />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="rgba(140,170,240,0.28)"
            strokeWidth="0.5"
          />
        </svg>
        <canvas id="s4game_canvas" />
        <div id="s4hud">
          <div id="s4poem_strip">
            <div className="poem-line" id="s4l0">
              눈은 푹푹 나리고
            </div>
            <div className="poem-line" id="s4l1">
              나는 나타샤를 생각하고
            </div>
            <div className="poem-line" id="s4l2">
              나타샤가 아니올 시 출출이 울고
            </div>
            <div className="poem-line" id="s4l3">
              백마 타고 오는 초인이 있어
            </div>
            <div className="poem-line" id="s4l4">
              이 밤이 지새도록 나는 우는 것이다
            </div>
          </div>
          <div id="s4stage_label">Stage 4 · 흰 눈길과 초인</div>
          <div id="s4fragment_hud">
            <div className="frag-dot" id="s4d0" />
            <div className="frag-dot" id="s4d1" />
            <div className="frag-dot" id="s4d2" />
            <div className="frag-dot" id="s4d3" />
            <div className="frag-dot" id="s4d4" />
          </div>
          <div id="s4ctrl">
            방향키 이동 · ↑ 점프
            <br />R · 탑승/하차 · E · 조사
          </div>
          <div id="s4mount_hint">[ R ] 당나귀에 올라타기</div>
          <div id="s4mounted_bar">🫏 당나귀를 타고 있다</div>
          <div id="s4word_flash" />
          <div id="s4thought" />
        </div>
        <div id="s4choin_overlay">
          <div id="s4choin_text" />
        </div>
        <div id="s4stage_clear">
          <div className="clear-poem">
            눈은 푹푹 나리고
            <br />
            나는 나타샤를 생각하고
            <br />
            나타샤가 아니올 시 출출이 울고
            <br />
            백마 타고 오는 초인이 있어
            <br />
            이 밤이 지새도록 나는 우는 것이다
          </div>
          <div className="poet-note">— 백석, 1938</div>
        </div>
        <div id="s4title_screen">
          <div className="t-tag">POEM GAME · 제1편</div>
          <div className="t-main">
            흰 눈길과
            <br />초인
          </div>
          <div className="t-sub">스테이지 4 — 깊은 산 속</div>
          <div className="t-verse">
            백마 타고 오는 초인이 있어
            <br />
            이 밤이 지새도록 나는 우는 것이다
          </div>
        </div>
      </div>

      {/* ═══ STAGE 5 ═══ */}
      <div className="sw" id="sw5">
        <svg
          id="s5cursor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
        >
          <circle cx="9" cy="9" r="3" fill="rgba(255,210,120,0.85)" />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="rgba(230,185,80,0.3)"
            strokeWidth="0.5"
          />
        </svg>
        <canvas id="s5game_canvas" />
        <div id="s5hud">
          <div id="s5poem_strip">
            <div className="poem-line" id="s5l0">
              나타샤는 나를 사랑하고
            </div>
            <div className="poem-line" id="s5l1">
              어데서 흰 당나귀도 오늘밤이 좋아서
            </div>
            <div className="poem-line" id="s5l2">
              응앙응앙 울 것이다
            </div>
          </div>
          <div id="s5stage_label">Stage 5 · 나타샤와 흰 당나귀</div>
          <div id="s5fragment_hud">
            <div className="frag-dot" id="s5d0" />
            <div className="frag-dot" id="s5d1" />
            <div className="frag-dot" id="s5d2" />
          </div>
          <div id="s5ctrl">
            방향키 이동 · ↑ 점프
            <br />R · 탑승/하차
          </div>
          <div id="s5mount_hint">[ R ] 당나귀에 올라타기</div>
          <div id="s5mounted_bar">🫏 당나귀를 타고 있다</div>
          <div id="s5word_flash" />
          <div id="s5thought" />
        </div>
        <div id="s5natasha_overlay">
          <div id="s5natasha_text" />
        </div>
        <div id="s5ending_screen">
          <div id="s5ending_poem">
            가난한 내가
            <br />
            아름다운 나타샤를 사랑해서
            <br />
            오늘밤은 푹푹 눈이 나린다
            <br />
            <br />
            나타샤를 사랑은 하고
            <br />
            눈은 푹푹 날리고
            <br />
            나는 혼자 쓸쓸히 앉어 소주를 마신다
            <br />
            <br />
            나타샤와 나는
            <br />
            눈이 푹푹 쌓이는 밤 흰 당나귀 타고
            <br />
            산골로 가자
            <br />
            <br />
            산골로 가는 것은 세상한테 지는 것이 아니다
            <br />
            세상 같은 건 더러워 버리는 것이다
            <br />
            <br />
            백마 타고 오는 초인이 있어
            <br />
            이 밤이 지새도록 나는 우는 것이다
            <br />
            <br />
            나타샤는 나를 사랑하고
            <br />
            어데서 흰 당나귀도 오늘밤이 좋아서
            <br />
            응앙응앙 울 것이다
          </div>
          <div id="s5ending_poet">— 백석 (白石), 1938</div>
          <div id="s5ending_author_note">
            백석(1912–1996)은 평북 정주 출신의 시인입니다.
            <br />
            일제강점기, 조선어의 아름다움을 지키며 향토적 시를 썼습니다.
            <br />
            나타샤는 실제 연인 김자야(기생 출신)로 알려져 있으며
            <br />
            이 시는 세상으로부터의 도피가 아닌,
            <br />순수한 사랑을 향한 탈주를 노래합니다.
          </div>
          <button id="s5restart_btn" onClick={() => location.reload()}>
            처음부터 다시
          </button>
        </div>
        <div id="s5title_screen">
          <div className="t-tag">POEM GAME · 제1편 · 마지막 스테이지</div>
          <div className="t-main">
            나타샤와
            <br />흰 당나귀
          </div>
          <div className="t-sub">스테이지 5 — 산골 마을</div>
          <div className="t-verse">
            나타샤는 나를 사랑하고
            <br />
            어데서 흰 당나귀도 오늘밤이 좋아서
            <br />
            응앙응앙 울 것이다
          </div>
        </div>
      </div>
    </>
  );
}
