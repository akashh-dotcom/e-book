import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import Library from './components/Library';
import ReaderPage from './components/Reader/ReaderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/library" element={<Library />} />
        <Route path="/read/:bookId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
