import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SceneNode } from '@nameless/engine';
import { LoreBubble, NarrationBubble, SayBubble } from '../components/Bubble';
import { ChoiceBar } from '../components/ChoiceBar';
import { Icon } from '../components/Icon';
import { loc, t } from '../i18n';
import { useGame } from '../store/game';
import { content, idx } from '../store/content';
import { backgroundImage, backgroundSvg, svgDataUri } from '../lib/art';
import { placeEmblem, placeKey, placeTone } from '../lib/emblems';
import { setAir } from '../lib/sound';
import { ArchiveSheet } from './ArchiveSheet';
import { CodexScreen } from './CodexScreen';
import { TutorialHint } from '../components/Tutorial';

/**
 * Имя в шапке пузыря берётся из реестра говорящих: там оно двуязычное.
 * Запасной вариант — читаемый вид id, чтобы новая роль не показывалась
 * пользователю сырым `golos_iz_trukhi`.
 */
const SPEAKER_NAMES = new Map(content.speakers.map((s) => [s.id, s.name]));

function speakerName(id: string, lang: 'ru' | 'en'): string {
  const known = SPEAKER_NAMES.get(id);
  if (known) return loc(known, lang);
  return id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function DialogueScreen() {
  const { state, step, lang, tap, pick } = useGame();
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [archive, setArchive] = useState(false);
  const [codex, setCodex] = useState(false);

  const log = state?.log ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length, step]);

  // Воздух места. Ключ считается тем же правилом, что и знак места, поэтому
  // картинка и звук не могут разойтись: зал Учёта всегда звучит залом Учёта.
  const scene = state?.scene;
  useEffect(() => {
    if (scene) setAir(placeKey(scene));
  }, [scene]);

  if (!state) return null;
  const drawnBg = backgroundImage(state.scene, placeKey(state.scene));
  const bg = drawnBg ?? svgDataUri(backgroundSvg(state.scene, placeTone(state.scene)));
  const isChoice = step?.kind === 'choice';

  /*
   * Канон: тело выцветает с каждой смертью, а тот, кто умеет отпускать,
   * сереет заметно медленнее. Числа игроку не показываются — он видит только,
   * что мир вокруг него теряет цвет. Это единственный видимый счётчик в игре.
   */
  const releasing = (state.axes['grasp_release'] ?? 0) <= -40;
  const greyness = Math.min(0.72, state.deaths * (releasing ? 0.06 : 0.11));

  /*
   * То же самое, но для лиц: у игрока серость растёт со смертями и замедляется
   * вдвое на краю отпускания, у Клёста наоборот — он проявляется от главы к
   * главе, потому что игрок его помнит (docs/PORTRAITS.md §2.2). Состояние
   * передаётся явным аргументом: рисунок обязан остаться чистой функцией,
   * иначе рушится детерминизм STYLE §7.6.
   */
  const portraitState = { deaths: state.deaths, releaseEdge: releasing, chapter: state.chapter };

  return (
    <div
      className="screen dialogue"
      style={{ '--greyness': greyness } as CSSProperties}
      onClick={isChoice ? undefined : tap}
    >
      <img className="scene-bg" src={bg} alt="" draggable={false} />
      {/* Знак места в пустоте над лентой. Верхняя треть экрана диалога — чистая
          чернота: фон-градиент там ничего не рисует, а лента прижата вниз.
          Знак заполняет её ровно настолько, чтобы сцена перестала быть
          безымянной, и не настолько, чтобы спорить с текстом (см. ART_PASS §5). */}
      {!drawnBg && <span className="scene-mark" style={placeEmblem(state.scene)} aria-hidden="true" />}

      <div className="top-bar">
        {/* Второй вход в Помянник — там же, где Опись: пауза забега (CODEX §7). */}
        <button
          className="archive-button"
          aria-label={t(lang, 'codexOpen')}
          onClick={(e) => {
            e.stopPropagation();
            setCodex(true);
          }}
        >
          <Icon name="candle" size={20} color="var(--text-dim)" />
        </button>
        <button
          className="archive-button"
          aria-label={t(lang, 'memories')}
          onClick={(e) => {
            e.stopPropagation();
            setArchive(true);
          }}
        >
          <Icon name="book" size={20} color="var(--text-dim)" />
        </button>
      </div>

      <div className="feed scroll" ref={feedRef}>
        {log.map((entry, i) => {
          const node = idx.nodes.get(`${entry.scene}#${entry.nodeId}`) as SceneNode | undefined;
          if (entry.kind === 'choice-made') {
            return (
              <div key={i} className="chosen">
                {lang === 'ru' ? entry.ru : entry.en}
              </div>
            );
          }
          if (!node) {
            return (
              <div key={i} className="narration">
                {lang === 'ru' ? entry.ru : entry.en}
              </div>
            );
          }
          if (node.kind === 'say') {
            return (
              <SayBubble
                key={i}
                speakerId={node.speaker}
                speakerName={speakerName(node.speaker, lang)}
                text={node.text}
                keywords={node.keywords}
                lang={lang}
                portraitState={portraitState}
              />
            );
          }
          if (node.kind === 'narration') {
            return <NarrationBubble key={i} text={node.text} keywords={node.keywords} lang={lang} />;
          }
          if (node.kind === 'lore') {
            return <LoreBubble key={i} title={node.title} text={node.text} lang={lang} />;
          }
          return null;
        })}
        <div ref={bottomRef} />
      </div>

      {isChoice && step.kind === 'choice' ? (
        <div className="choice-area">
          <TutorialHint step="choice" lang={lang} anchor="flow" />
          <ChoiceBar
            options={step.options}
            prompt={step.node.prompt ? loc(step.node.prompt, lang) : undefined}
            lang={lang}
            onPick={pick}
          />
        </div>
      ) : (
        // Подсказка «коснись экрана» стоит в потоке под лентой, а не поверх неё:
        // всплывашка с anchor="bottom" ложилась ровно на нижнюю (то есть свежую)
        // реплику — на первом экране игры она накрывала собой самую первую фразу.
        <div className="tap-area">
          <TutorialHint step="tap" lang={lang} anchor="flow" />
          <div className="tap-hint">{t(lang, 'tapToContinue')}</div>
        </div>
      )}

      {archive && <ArchiveSheet state={state} lang={lang} onClose={() => setArchive(false)} />}
      {codex && <CodexScreen lang={lang} onClose={() => setCodex(false)} />}
    </div>
  );
}
