import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Props = { title: ReactNode; icon?: IconName; sub?: ReactNode; right?: ReactNode; className?: string; children: ReactNode; style?: React.CSSProperties; id?: string };

/** Carte à en-tête (legacy `card`). */
export function Card({ title, icon, sub, right, className = '', children, style, id }: Props) {
  return (
    <section id={id} className={`card panel ${className}`} style={style}>
      <div className="cardhead">
        <h2>
          {icon && <Icon name={icon} />}
          {title}
          {sub != null && sub !== '' && <span className="sub"> {sub}</span>}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}
