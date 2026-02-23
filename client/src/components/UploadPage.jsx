import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, BookOpen } from 'lucide-react';
import useBookStore from '../store/bookStore';
import Library from './Library';

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { uploadBook, fetchBooks, books } = useBookStore();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.epub')) {
      setError('Please select an .epub file');
      return;
    }
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      const book = await uploadBook(file, setProgress);
      navigate(`/read/${book._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h1>
          <BookOpen size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 12 }} />
          EPUB Reader
        </h1>
        <p>Upload an EPUB file to start reading</p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="upload-icon">
          <Upload size={40} />
        </div>
        <div className="upload-text">
          <strong>Click to upload</strong> or drag and drop
        </div>
        <div className="upload-hint">EPUB files up to 100MB</div>

        {uploading && (
          <div className="upload-progress">
            <div className="upload-progress-bar">
              <div
                className="upload-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', marginTop: 12, fontSize: '0.88rem' }}>
            {error}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {books.length > 0 && <Library />}
    </div>
  );
}
