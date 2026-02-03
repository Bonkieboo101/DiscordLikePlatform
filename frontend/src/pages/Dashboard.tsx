import React, { useState } from 'react';
import WorkspaceList from '../components/Workspace/WorkspaceList';
import UserBadge from '../components/UserBadge';
import WorkspaceCreateModal from '../components/Workspace/WorkspaceCreateModal';
import ChannelList from '../components/Channel/ChannelList';
import ChannelCreateModal from '../components/Channel/ChannelCreateModal';
import MemberList from '../components/Workspace/MemberList';
import ChatWindow from '../components/Chat/ChatWindow';
import { useMessageStore } from '../stores/messageStore';
import DMList from '../components/DM/DMList';
import DMCreateModal from '../components/DM/DMCreateModal';
import DMChatWindow from '../components/DM/DMChatWindow';
import { useDMStore } from '../stores/dmStore';

export default function Dashboard() {
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(()=>{
    const check = ()=>{ setIsMobile(window.innerWidth < 768); if(window.innerWidth < 768){ setShowLeft(false); setShowRight(false); } else { setShowLeft(true); setShowRight(true); } };
    check(); window.addEventListener('resize', check); return ()=>window.removeEventListener('resize', check);
  },[]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {showLeft && <aside style={{ width: 240, borderRight: '1px solid #ddd', padding: 8 }}>
        <button onClick={() => setShowWorkspaceModal(true)}>+ New Workspace</button>
        <WorkspaceList />
      </aside>}

      {showRight && <aside style={{ width: 260, borderRight: '1px solid #ddd', padding: 8 }}>
        <button onClick={() => setShowChannelModal(true)}>+ New Channel</button>
        <ChannelList />
        <MemberList />
        <div style={{marginTop:16}}>
          <DMCreateModal />
          <DMList />
        </div>
      </aside>}

      <main style={{ flex: 1, padding: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {isMobile && <button onClick={()=>setShowLeft((s)=>!s)} aria-label="Toggle sidebar">☰</button>}
            <h2>Messages</h2>
          </div>
          <div>
            <UserBadge />
          </div>
        </header>
        <section style={{height:'calc(100% - 64px)'}}>
          {useDMStore((s)=>s.currentConversationId) ? (
            <DMChatWindow conversationId={useDMStore((s)=>s.currentConversationId)} />
          ) : (
            <ChatWindow channelId={useMessageStore((s)=>s.currentChannelId)} />
          )}
        </section>
      </main>

      {showWorkspaceModal && <WorkspaceCreateModal onClose={() => setShowWorkspaceModal(false)} />}
      {showChannelModal && <ChannelCreateModal onClose={() => setShowChannelModal(false)} />}
    </div>
  );
}
