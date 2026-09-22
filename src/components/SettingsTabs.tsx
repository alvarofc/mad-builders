import { useEffect, useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import '../styles/settings-tabs.css';

const sections = [
  ['profile', 'Profile'], ['socials', 'Social links'], ['team', 'Team'],
  ['updates', 'Updates'], ['danger', 'Danger zone'],
] as const;

type Props = Record<(typeof sections)[number][0], ReactNode>;

export default function SettingsTabs(props: Props) {
  const [active, setActive] = useState('profile');
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      setActive(sections.some(([id]) => id === hash) ? hash : 'profile');
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return <Tabs className="settings-tabs" value={active} onValueChange={value => {
    setActive(value);
    window.history.replaceState(null, '', `#${value}`);
  }}>
    <TabsList className="settings-tab-list" aria-label="Settings sections">
      {sections.map(([id, label]) => <TabsTrigger className="settings-tab" key={id} value={id}>{label}</TabsTrigger>)}
    </TabsList>
    {sections.map(([id]) => <TabsContent className="settings-panel" key={id} value={id} forceMount hidden={active !== id}>
      {props[id]}
    </TabsContent>)}
  </Tabs>;
}
