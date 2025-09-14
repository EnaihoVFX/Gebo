import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home/Home';
import VideoEditor from './pages/VideoEditor/VideoEditor';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<VideoEditor />} />
      </Routes>
    </Router>
  );
}
