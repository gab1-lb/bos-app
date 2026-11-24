import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Spark } from './Spark';

/** Carte indicateur (legacy `metric`). `value` null → « À obtenir ». */
export function Metric({ label, icon, value, foot, spark, href, naLabel }: {
  label: ReactNode; icon: IconName; value: ReactNode | null; foot?: ReactNode; spark?: (number | null)[] | null; href?: string; naLabel: string;
}) {
  const body = (
    <>
      <span className="mtop"><Icon name={icon} />{label}</span>
      {value == null ? <div className="value na">{naLabel}</div> : <div className="value">{value}</div>}
      {spark && <Spark values={spark} />}
      <span className="mfoot">{foot || ' '}</span>
    </>
  );
  return href ? <Link className="metric" href={href}>{body}</Link> : <div className="metric">{body}</div>;
}
