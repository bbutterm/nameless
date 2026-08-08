import { useEffect, useRef } from 'react';
import type { SceneNode } from '@nameless/engine';
import { LoreBubble, NarrationBubble, SayBubble } from '../components/Bubble';
import { ChoiceBar } from '../components/ChoiceBar';
import { loc, t } from '../i18n';
import { idx, useGame } from '../store/game';
import { backgroundSvg, svgDataUri } from '../lib/art';

/** Имя говорящего: в контенте оно живёт в сцене, а не в реестре — реестр только про арт. */
function speakerName(id: string, lang: 'ru' | 'en'): string {
  const NAMES: Record<string, { ru: string; en: string }> = {
    osoka: { ru: 'Осока', en: 'Osoka' },
    tminny: { ru: 'Тминный', en: 'Tminny' },
    proshchai: { ru: 'Брат Прощай', en: 'Brother Farewell' },
    zhichka: { ru: 'Жичка', en: 'Zhichka' },
    dratva: { ru: 'Капрал Дратва', en: 'Corporal Dratva' },
    klyost: { ru: 'Клёст', en: 'Klyost' },
    revizor: { ru: 'Ревизор', en: 'The Auditor' },
    player: { ru: 'Ты', en: 'You' },
  };
  const known = NAMES[id];
  if (known) return known[lang];
  return id.replace(/_/g, ' ');
}

export function DialogueScreen() {
  const { state, step, lang, tap, pick } = useGame();
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const log = state?.log ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length, step]);

  if (!state) return null;
  const bg = svgDataUri(backgroundSvg(state.scene));
  const isChoice = step?.kind === 'choice';

  return (
    <div className="screen dialogue" onClick={isChoice ? undefined : tap}>
      <img className="scene-bg" src={bg} alt="" draggable={false} />

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
        <ChoiceBar
          options={step.options}
          prompt={step.node.prompt ? loc(step.node.prompt, lang) : undefined}
          lang={lang}
          onPick={pick}
        />
      ) : (
        <div className="tap-hint">{t(lang, 'tapToContinue')}</div>
      )}
    </div>
  );
}
