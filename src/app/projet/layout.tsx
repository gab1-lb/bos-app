import { AppShell } from '../../components/shell/AppShell';

export default function ProjetLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
