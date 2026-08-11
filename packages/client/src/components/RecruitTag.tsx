import { useEffect, useState } from 'react';
import {
  scaleStats,
  type Lang,
  type LocalizedText,
  type PartyUnit,
} from '@nameless/engine';
import { loc, t, traitWords } from '../i18n';
import { portraitImage, svgDataUri, unitCardSvg } from '../lib/art';
import { unitEmblem } from '../lib/emblems';
import { abilityChips, abilityDeed, referenceArmor } from '../lib/combatRead';
import { combat, content } from '../store/content';
import { vibrate } from '../lib/haptics';
import { playSfx } from '../lib/sound';
import { Icon } from './Icon';

/**
 * Бирка вербовки — одна на все `recruit`, без единого имени юнита в коде.
 *
 * Правило канона (КАНОН_КРАТКО §9.2, REVIEW_GAMEPLAY §2.П1): спутник входит в
 * отряд — игрок видит лицо, имя, два-три слова нрава, что умеет в бою строками
 * «название — глагол и число», и ряд. До этого вербовка была строкой нарратива:
 * «оно идёт следом» — и игрок входил в первый бой с отрядом, о способностях
 * которого ему не сказали ни слова («какие-то скиллы» из отзыва владельца).
 *
 * Всё на бирке собрано из данных юнита и его способностей — ни одного текста
 * про конкретного спутника здесь нет и быть не может: новый юнит в
 * `data/units/*` получает бирку сам, ничего не дописывая в клиент.
 */

/** Столько слов нрава помещается в строку под именем на 360px. */
const MAX_TRAITS = 3;

/** Опорная броня для чисел вне боя — считается один раз на весь ростер. */
const ARMOR = referenceArmor(content.units);

/**
 * Столько бирка не принимает тапов после появления.
 *
 * Без этой паузы бирка гаснет, не будучи прочитанной, и оба раза — не по воле
 * игрока. В диалоге он тапает подряд, реплика за репликой: бирка всплывает
 * между двумя тапами, и следующий, уже занесённый, закрывает её мгновенно.
 * В описи хуже: бирка открывается по удержанию — прямо под пальцем, — и
 * событие «палец отпустили» приходит уже в неё.
 *
 * Длина взята от появления: `rise` идёт 240ms, и раньше, чем бирка дорисуется,
 * закрывать её нечего.
 */
const ARM_MS = 450;

export function RecruitTag({
  unit,
  lang,
  look,
  onClose,
}: {
  unit: PartyUnit;
  lang: Lang;
  /** Та же бирка, открытая позже из описи, а не в момент вступления в отряд. */
  look?: boolean;
  onClose: () => void;
}) {
  const [armed, setArmed] = useState(false);

  /*
   * Момент вступления в отряд — единственное место, где игра говорит «этот
   * человек теперь твой». Звучит и отзывается он только здесь: та же бирка,
   * открытая позже из описи (`look`), — просто справка, и подчёркивать её
   * нечем, иначе подчёркивание перестанет что-либо значить.
   */
  useEffect(() => {
    if (!look) {
      vibrate('recruit');
      playSfx('recruit');
    }
    setArmed(false);
    const id = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(id);
  }, [unit.uid, look]);

  /** Закрыть можно только осознанным тапом — см. `ARM_MS`. */
  const close = (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    if (armed) onClose();
  };

  const def = combat.units.get(unit.defId);
  // Лицо: портрет пользователя, если он есть, иначе карта, иначе процедурная
  // заглушка со знаком дома — тот же порядок, что на карточке в бою.
  const face = portraitImage(unit.defId);
  const art =
    face ??
    svgDataUri(
      def ? unitCardSvg(def.id, def.tier, def.faction) : unitCardSvg(unit.defId, 1),
    );
  const mark = face ? undefined : unitEmblem(unit.defId, def?.faction);
  const traits = (def?.traits ?? [])
    .map((id) => ({ id, word: traitWords[id] }))
    .filter((x): x is { id: string; word: LocalizedText } => !!x.word)
    .slice(0, MAX_TRAITS);
  const abilities = (def?.abilities ?? [])
    .map((id) => combat.abilities.get(id))
    .filter((a): a is NonNullable<typeof a> => !!a && !a.passive);
  // Числа берутся по УРОВНЮ этого экземпляра, а не по базе из данных: ту же
  // бирку игрок открывает из описи через десять боёв, и «урон 8–11» у юнита
  // третьего уровня был бы враньём.
  const atk = def ? scaleStats(def, unit.level).atk : 0;

  return (
    // Клик не всплывает: бирку открывают и поверх описи, а её подложка закрыла
    // бы разом обе.
    <div className="tag-backdrop" onClick={close}>
      <div className="recruit-tag" onClick={(e) => e.stopPropagation()}>
        {!look && <div className="tag-kicker">{t(lang, 'joinedParty')}</div>}

        <div className={`tag-face tier-${def?.tier ?? 1}`}>
          <img src={art} alt="" draggable={false} />
          {mark && <span className="card-mark" style={mark} aria-hidden="true" />}
        </div>

        <h2 className="tag-name">{def ? loc(def.name, lang) : unit.defId}</h2>

        {traits.length > 0 && (
          <div className="tag-traits">
            {traits.map((x) => (
              <span key={x.id} className="tag-trait">
                {loc(x.word, lang)}
              </span>
            ))}
          </div>
        )}

        {def && <div className="tag-blurb">{loc(def.blurb, lang)}</div>}

        <div className="tag-deeds scroll">
          <div className="tag-label">{t(lang, 'recruitCan')}</div>
          {abilities.length === 0 && <div className="tag-blurb">{t(lang, 'recruitNoAbilities')}</div>}
          {abilities.map((a) => {
            const deed = abilityDeed(atk, a, lang, ARMOR);
            return (
              <div key={a.id} className="tag-deed">
                <Icon name={a.icon} size={18} color="var(--accent)" />
                <div className="deed-body">
                  <div className="deed-head">
                    <b>{loc(a.name, lang)}</b>
                    {deed && <span className={`chip-deed deed-${deed.tone}`}>{deed.text}</span>}
                  </div>
                  <div className="deed-chips">
                    {abilityChips(a, lang).map((c) => (
                      <span key={c} className="chip-info">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ряд — тот, в который юнит УЖЕ встал (`slot`), а не предпочтительный
            из данных: игрок читает бирку и сразу знает, где искать это лицо
            на доске. Переставить его можно в описи. */}
        <div className="tag-place">
          {t(lang, 'recruitPlace')}:{' '}
          <b>{unit.slot.row === 'front' ? t(lang, 'rowFront') : t(lang, 'rowBack')}</b>
        </div>

        <button className="big-button tag-close" onClick={close}>
          {t(lang, look ? 'close' : 'proceed')}
        </button>
      </div>
    </div>
  );
}
