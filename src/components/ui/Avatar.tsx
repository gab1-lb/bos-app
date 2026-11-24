'use client';
import { useState } from 'react';
import type { Member } from '../../domain/permissions';

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Photo Google du membre, sinon ses initiales (aussi si l'image ne charge pas). */
type AvatarProps = {
  member?: Pick<Member, 'name' | 'avatarUrl'> | null; name?: string; size?: '' | 'sm'; decorative?: boolean;
};

/** Keyed on the URL so a new photo gets a fresh try after an earlier one failed. */
export function Avatar(props: AvatarProps) {
  return <AvatarInner key={props.member?.avatarUrl ?? ''} {...props} />;
}

function AvatarInner({ member, name, size = '', decorative = false }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const label = member?.name || name || '';
  const url = member?.avatarUrl;
  return (
    <span className={`avatar ${size}`} title={label} aria-hidden={decorative || undefined}>
      {url && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span aria-hidden="true">{initials(label) || '?'}</span>}
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
