import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import Library from './components/Library';
import ReaderPage from './components/Reader/ReaderPage';
import SyncEditorPage from './components/SyncEditor/SyncEditorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/library" element={<Library />} />
        <Route path="/read/:bookId" element={<ReaderPage />} />
        <Route path="/sync-editor/:bookId/:chapterIndex" element={<SyncEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
