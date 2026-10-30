import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MeetingsTable from '../components/MeetingsTable.jsx';
import { Button } from '../components/ui.jsx';

export default function Meetings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">All meetings</h1>
        <Link to="/meetings/new"><Button icon={Plus}>New meeting</Button></Link>
      </div>
      <MeetingsTable title="Your meetings" pageSize={10} emptyAction={<Link to="/meetings/new"><Button icon={Plus}>Create meeting</Button></Link>} />
    </div>
  );
}
