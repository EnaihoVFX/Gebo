import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Film } from 'lucide-react';
import { openProjectPicker, saveProjectPicker } from './utils/fileUtils';
import { loadProject, newProject, type ProjectFile } from '../../lib/projectFile';
import { getRecentProjects, addRecentProject } from '../../lib/longtermStorage';
import { useNavigate } from 'react-router-dom';

// Type definitions (ProjectFile is now imported from lib)

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: { [key: string]: string | number | boolean }) => Promise<void>;
  title: string;
  fields: {
    [key: string]: {
      type: string;
      placeholder: string;
    };
  };
}

interface LoadingScreenProps {
  onComplete: () => void;
  projectTitle?: string;
}

interface RecentProjectProps {
  projectPath: string;
  onLoadingStart: (title: string) => void;
  onProjectOpened: () => void;
}

// Real functions using actual lib implementations

// Mock components
const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, onSubmit, title, fields }) => {
  const [values, setValues] = useState<{ [key: string]: string }>({ title: '' });
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-zinc-900/35 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-[0_8px_32px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
        <div className="relative">
          <h3 className="text-xl font-semibold mb-6 text-white/90">{title}</h3>
          <input
            type="text"
            placeholder={fields.title.placeholder}
            value={values.title}
            onChange={(e) => setValues({ title: e.target.value })}
            className="w-full p-4 bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          />
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(values)}
              className="flex-1 py-3 px-6 bg-white/10 backdrop-blur-xl border border-white/30 rounded-xl text-white font-semibold hover:bg-white/20 transition-all duration-300 transform hover:scale-[1.02] shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, projectTitle }) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    
    return () => clearInterval(interval);
  }, [onComplete]);
  
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-2xl bg-zinc-900/35 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]"></div>
          <div className="absolute inset-3 rounded-xl bg-white/5 border border-white/20 animate-spin" style={{animationDuration: '2s'}}></div>
          <div className="absolute inset-6 rounded-lg bg-zinc-800/40 backdrop-blur-sm flex items-center justify-center">
            <Film className="w-6 h-6 text-white/70" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-4 text-white/90">
          {projectTitle || 'Loading...'}
        </h3>
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden mx-auto shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <div 
            className="h-full bg-white/30 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-white/50 mt-4 text-sm">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

const RecentProject: React.FC<RecentProjectProps> = ({ projectPath, onLoadingStart, onProjectOpened }) => {
  const navigate = useNavigate();
  const projectName = projectPath.split('/').pop()?.replace('.gebo', '') || 'Untitled Project';
  const [thumbnail, setThumbnail] = useState<string>('');
  
  useEffect(() => {
    // Generate gradient based on project name
    const gradients = [
      'from-zinc-700 to-zinc-800',
      'from-zinc-600 to-zinc-700', 
      'from-zinc-800 to-zinc-900'
    ];
    const gradient = gradients[projectName.length % gradients.length];
    setThumbnail(gradient);
  }, [projectName]);
  
  const handleClick = async () => {
    onLoadingStart(projectName);
    try {
      await loadProject(projectPath);
      await addRecentProject(projectPath);
      onProjectOpened();
      navigate('/editor');
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };
  
  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer w-full"
    >
      <div className={`w-full aspect-video bg-gradient-to-br ${thumbnail} rounded-xl mb-3 flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden relative group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:transform group-hover:scale-[1.02]`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-100 group-hover:opacity-60 transition-all duration-500"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600"></div>
        <div className="relative z-10 w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-all duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <Film className="w-5 h-5 text-white/80" />
        </div>
      </div>
      
      <div className="px-1">
        <h4 className="font-medium text-sm text-white/80 truncate mb-1 group-hover:text-white transition-colors duration-300">
          {projectName}
        </h4>
        <p className="text-xs text-white/50">
          Recently edited
        </p>
      </div>
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProjectTitle, setLoadingProjectTitle] = useState<string | undefined>();
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  useEffect(() => {
    loadRecentProjects();
    const handleFocus = () => loadRecentProjects();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadRecentProjects = async () => {
    try {
      const projects = await getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  };

  const openFlow = async () => {
    const path = await openProjectPicker();
    if (!path) return;

    setIsLoading(true);
    setLoadingProjectTitle('Opening Project...');

    try {
      const projectFile = await loadProject(path);
      await addRecentProject(path);
      await loadRecentProjects();
      setLoadingProjectTitle(projectFile.title);
    } catch (error) {
      console.error("Failed to open project file:", error);
      setLoadingProjectTitle(undefined);
      setIsLoading(false);
    }
  };

  const handleRecentProjectLoading = (title: string) => {
    setIsLoading(true);
    setLoadingProjectTitle(title);
  };

  const createFlow = async (values: { [key: string]: string | number | boolean }) => {
    const path = await saveProjectPicker();
    if (!path) return;

    const projectFile: ProjectFile = { 
      title: values.title as string, 
      clips_map: new Map(), 
      tracks_map: new Map(), 
      path 
    };
    setIsLoading(true);
    setLoadingProjectTitle(projectFile.title);

    try {
      await newProject(projectFile);
      await addRecentProject(path);
      await loadRecentProjects();
    } catch (error) {
      console.error("Failed to save project file:", error);
      setIsLoading(false);
      setLoadingProjectTitle(undefined);
    }
  };

  const handleLoadingComplete = async () => {
    try {
      navigate('/editor');
    } catch (error) {
      console.error('Failed to navigate to editor:', error);
    }
    setIsLoading(false);
    setLoadingProjectTitle(undefined);
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen 
          onComplete={handleLoadingComplete}
          projectTitle={loadingProjectTitle}
        />
      ) : (
        <div className="min-h-screen bg-zinc-950 font-sans">
          {/* Header with Logo and Buttons */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
            <img 
              src="/logo.png" 
              alt="Video Editor Logo" 
              className="h-8 w-auto opacity-90" 
            />
            
            <div className="flex gap-4">
              <button 
                onClick={() => setModalOpen(true)}
                className="group flex items-center justify-center px-6 py-3 bg-zinc-900/35 backdrop-blur-2xl border border-white/20 text-white rounded-xl font-medium hover:bg-zinc-800/50 hover:border-white/30 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)] hover:transform hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600"></div>
                <Plus className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">Create new</span>
              </button>

              <button 
                onClick={openFlow}
                className="group flex items-center justify-center px-6 py-3 bg-zinc-900/25 backdrop-blur-2xl border border-white/15 text-white/90 rounded-xl font-medium hover:bg-zinc-800/40 hover:border-white/25 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.4)] hover:transform hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/6 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600"></div>
                <FolderOpen className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">Open project</span>
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto p-8">

            {/* Recent Projects Section with Glass Container */}
            {recentProjects.length > 0 && (
              <div className="bg-zinc-900/20 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl"></div>
                <div className="relative">
                  <div className="text-center mb-8">
                    <h2 className="text-xl font-semibold text-white/90 mb-2">Recent Projects</h2>
                    <div className="w-16 h-px bg-white/20 mx-auto"></div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {recentProjects.map((projectPath, index) => (
                      <div
                        key={index}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                      >
                        <RecentProject
                          projectPath={projectPath}
                          onLoadingStart={handleRecentProjectLoading}
                          onProjectOpened={loadRecentProjects}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={createFlow}
        title="Create New Project"
        fields={{
          title: { type: 'string', placeholder: 'Enter project title...' },
        }}
      />
    </>
  );
}