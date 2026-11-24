import { AppShell } from '../../components/shell/AppShell';
import { Placeholder } from '../../components/shell/Placeholder';

export default function AdminPage() {
  return <AppShell><Placeholder title="Administration" adminOnly /></AppShell>;
}
