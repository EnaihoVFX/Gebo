import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Film } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

// Advanced glassmorphism styles
const glassStyles = `
  @keyframes glass-float {
    0%, 100% { transform: translateY(0px) rotateX(0deg); }
    50% { transform: translateY(-1px) rotateX(0.5deg); }
  }

  @keyframes glass-pulse {
    0%, 100% { 
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 4px 16px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    }
    50% { 
      box-shadow: 
        0 12px 40px rgba(0, 0, 0, 0.5),
        0 6px 20px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        inset 0 -1px 0 rgba(0, 0, 0, 0.15);
    }
  }

  @keyframes glass-refract {
    0% { opacity: 0.3; transform: translateX(-100%) skewX(-15deg); }
    50% { opacity: 0.8; transform: translateX(0%) skewX(0deg); }
    100% { opacity: 0.3; transform: translateX(100%) skewX(15deg); }
  }

  .glass-3d-button {
    position: relative;
    background: linear-gradient(135deg, 
      rgba(39, 39, 42, 0.6) 0%,
      rgba(63, 63, 70, 0.55) 25%,
      rgba(39, 39, 42, 0.5) 50%,
      rgba(24, 24, 27, 0.45) 75%,
      rgba(9, 9, 11, 0.4) 100%);
    backdrop-filter: blur(25px) saturate(1.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 2px 4px rgba(255, 255, 255, 0.1),
      inset 0 -2px 4px rgba(0, 0, 0, 0.15),
      inset 2px 0 4px rgba(255, 255, 255, 0.05),
      inset -2px 0 4px rgba(0, 0, 0, 0.08);
    transform-style: preserve-3d;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .glass-3d-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(180deg, 
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.1) 30%,
      rgba(255, 255, 255, 0.05) 70%,
      transparent 100%);
    border-radius: 12px 12px 0 0;
    pointer-events: none;
  }

  .glass-3d-button::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 2px;
    background: linear-gradient(90deg, 
      transparent 0%,
      rgba(255, 255, 255, 0.3) 20%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0.3) 80%,
      transparent 100%);
    border-radius: 2px;
    filter: blur(0.5px);
  }

  .glass-3d-button:hover {
    transform: translateY(-1px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 5px 20px rgba(0, 0, 0, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.15),
      inset 0 -2px 4px rgba(0, 0, 0, 0.2);
    background: linear-gradient(135deg, 
      rgba(39, 39, 42, 0.7) 0%,
      rgba(63, 63, 70, 0.65) 25%,
      rgba(39, 39, 42, 0.6) 50%,
      rgba(24, 24, 27, 0.55) 75%,
      rgba(9, 9, 11, 0.5) 100%);
  }

  .glass-3d-button:active {
    transform: translateY(0px);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .glass-3d-button-primary {
    position: relative;
    background: linear-gradient(135deg, 
      rgba(39, 39, 42, 0.6) 0%,
      rgba(63, 63, 70, 0.55) 25%,
      rgba(39, 39, 42, 0.5) 50%,
      rgba(24, 24, 27, 0.45) 75%,
      rgba(9, 9, 11, 0.4) 100%);
    backdrop-filter: blur(25px) saturate(1.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 2px 4px rgba(255, 255, 255, 0.1),
      inset 0 -2px 4px rgba(0, 0, 0, 0.15);
    transform-style: preserve-3d;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .glass-3d-button-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(180deg, 
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.1) 30%,
      rgba(255, 255, 255, 0.05) 70%,
      transparent 100%);
    border-radius: 12px 12px 0 0;
    pointer-events: none;
  }

  .glass-3d-button-primary::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 2px;
    background: linear-gradient(90deg, 
      transparent 0%,
      rgba(255, 255, 255, 0.5) 20%,
      rgba(255, 255, 255, 0.6) 50%,
      rgba(255, 255, 255, 0.5) 80%,
      transparent 100%);
    border-radius: 2px;
    filter: blur(0.5px);
  }

  .glass-3d-button-primary:hover {
    transform: translateY(-1px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 5px 20px rgba(0, 0, 0, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.15),
      inset 0 -2px 4px rgba(0, 0, 0, 0.2);
    background: linear-gradient(135deg, 
      rgba(39, 39, 42, 0.7) 0%,
      rgba(63, 63, 70, 0.65) 25%,
      rgba(39, 39, 42, 0.6) 50%,
      rgba(24, 24, 27, 0.55) 75%,
      rgba(9, 9, 11, 0.5) 100%);
  }

  .glass-3d-button-primary:active {
    transform: translateY(0px);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }



  .glass-card {
    background: rgba(39, 39, 42, 0.85);
    backdrop-filter: blur(25px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 4px 16px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .glass-card-recent {
    background: rgba(39, 39, 42, 0.3);
    backdrop-filter: blur(25px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .modal-overlay {
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
  }

  .modal-content {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-content.open {
    transform: scale(1) translateY(0);
    opacity: 1;
  }

  .glass-thumbnail {
    background: linear-gradient(135deg, 
      rgba(39, 39, 42, 0.4) 0%,
      rgba(63, 63, 70, 0.35) 25%,
      rgba(39, 39, 42, 0.3) 50%,
      rgba(24, 24, 27, 0.25) 75%,
      rgba(9, 9, 11, 0.2) 100%);
    backdrop-filter: blur(20px) saturate(1.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .glass-thumbnail:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 4px 16px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 0 rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
  }
`;

// Type definitions
interface Clip {
  id: string;
  path: string;
  latest_probe?: any;
  type: 'Video' | 'Audio' | 'Image';
}

interface Segment {
  id: string;
  clip_id: string;
  start: number;
  end: number;
}

interface Track {
  id: string;
  name: string;
  type: 'Video' | 'Audio' | 'Text' | 'Effect';
  enabled: boolean;
  muted: boolean;
  volume: number;
  order: number;
  segments: Segment[];
}

interface ProjectFile {
  title: string;
  clips_map: Record<string, Clip>;
  tracks_map: Record<string, Track>;
  path?: string;
}

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

// Real backend functions using Tauri API
const openProjectPicker = async (): Promise<string | null> => {
  try {
    const result = await open({
      title: 'Open Project',
      filters: [
        {
          name: 'Video Copilot Project',
          extensions: ['vid']
        }
      ]
    });
    return result as string | null;
  } catch (error) {
    console.error('Failed to open project picker:', error);
    return null;
  }
};

const saveProjectPicker = async (): Promise<string | null> => {
  try {
    const result = await save({
      title: 'Save Project',
      filters: [
        {
          name: 'Video Copilot Project',
          extensions: ['vid']
        }
      ]
    });
    return result as string | null;
  } catch (error) {
    console.error('Failed to open save dialog:', error);
    return null;
  }
};

const loadProject = async (path: string): Promise<ProjectFile> => {
  try {
    const project = await invoke<ProjectFile>('load_project', { path });
    return project;
  } catch (error) {
    console.error('Failed to load project:', error);
    throw error;
  }
};

const newProject = async (project: ProjectFile): Promise<ProjectFile> => {
  try {
    const result = await invoke<ProjectFile>('new_project', { projectFile: project });
    return result;
  } catch (error) {
    console.error('Failed to create new project:', error);
    throw error;
  }
};

const getRecentProjects = async (): Promise<string[]> => {
  try {
    const projects = await invoke<string[]>('get_recent_projects');
    console.log('Backend returned projects:', projects);
    return projects;
  } catch (error) {
    console.error('Failed to get recent projects:', error);
    return [];
  }
};

const addRecentProject = async (path: string): Promise<void> => {
  try {
    await invoke('add_recent_project', { path });
  } catch (error) {
    console.error('Failed to add recent project:', error);
  }
};

const openEditorWindow = async (): Promise<void> => {
  try {
    await invoke('create_editor_window');
  } catch (error) {
    console.error('Failed to open editor window:', error);
    throw error;
  }
};

// Mock components
const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, onSubmit, title, fields }) => {
  const [values, setValues] = useState<{ [key: string]: string }>({ title: '' });
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <>
      <style>{glassStyles}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 modal-overlay" onClick={onClose}></div>
        <div className={`relative glass-card rounded-xl p-6 max-w-sm w-full modal-content ${isAnimating ? 'open' : ''}`}>
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4 text-white/90">{title}</h3>
            <input
              type="text"
              placeholder={fields.title.placeholder}
              value={values.title}
              onChange={(e) => setValues({ title: e.target.value })}
              className="w-full p-3 glass-card rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/30 transition-all duration-300 text-sm border-0"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="glass-3d-button flex-1 py-2 px-4 text-white/80 font-medium text-sm relative"
              >
                <span className="relative z-10">Cancel</span>
              </button>
              <button
                onClick={() => onSubmit(values)}
                className="glass-3d-button-primary flex-1 py-2 px-4 text-white font-semibold text-sm relative"
              >
                <span className="relative z-10">Create</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
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
    <>
      <style>{glassStyles}</style>
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-8 relative glass-card rounded-2xl">
            <div className="absolute inset-3 rounded-xl bg-white/5 border border-white/20 animate-spin" style={{animationDuration: '2s'}}></div>
            <div className="absolute inset-6 rounded-lg bg-zinc-800/40 backdrop-blur-sm flex items-center justify-center">
              <Film className="w-6 h-6 text-white/70" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-4 text-white/90">
            {projectTitle || 'Loading...'}
          </h3>
          <div className="w-64 h-2 glass-card rounded-full overflow-hidden mx-auto">
            <div 
              className="h-full bg-white/30 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-white/50 mt-4 text-sm">{Math.round(progress)}%</p>
        </div>
      </div>
    </>
  );
};

const RecentProject: React.FC<RecentProjectProps> = ({ projectPath, onLoadingStart, onProjectOpened }) => {
  const projectName = projectPath.split('/').pop()?.replace('.vid', '') || 'Untitled Project';
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
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };
  
  return (
    <>
      <style>{glassStyles}</style>
      <div
        onClick={handleClick}
        className="group cursor-pointer w-full"
      >
        <div className={`w-full aspect-video bg-gradient-to-br ${thumbnail} glass-thumbnail rounded-lg mb-2 flex items-center justify-center overflow-hidden relative`}>
          <div className="relative z-20 w-10 h-10 glass-card backdrop-blur-2xl rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-500">
            <Film className="w-4 h-4 text-white/90 group-hover:text-white transition-colors duration-300 relative z-10" />
          </div>
        </div>
        
        <div className="px-1">
          <h4 className="font-medium text-xs text-white/80 truncate mb-0.5 group-hover:text-white transition-colors duration-300">
            {projectName}
          </h4>
          <p className="text-[10px] text-white/50">
            Recently edited
          </p>
        </div>
      </div>
    </>
  );
};

export default function Home() {
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

  // Debug: Log when recentProjects state changes
  useEffect(() => {
    console.log('Recent projects state updated:', recentProjects);
  }, [recentProjects]);

  const loadRecentProjects = async () => {
    try {
      const projects = await getRecentProjects();
      console.log('Loaded recent projects:', projects);
      
      // If no projects exist, show some test projects for demo purposes
      if (projects.length === 0) {
        console.log('No recent projects found, showing test projects');
        const testProjects = [
          '/Users/Test/Documents/My_Video_Project.vid',
          '/Users/Test/Documents/Summer_Vacation_2024.vid',
          '/Users/Test/Documents/Birthday_Party_Edit.vid',
          '/Users/Test/Documents/Wedding_Highlights.vid',
          '/Users/Test/Documents/Travel_Montage.vid',
          '/Users/Test/Documents/Corporate_Presentation.vid'
        ];
        setRecentProjects(testProjects);
      } else {
        setRecentProjects(projects);
      }
    } catch (error) {
      console.error('Failed to load recent projects:', error);
      // Show test projects on error too
      const testProjects = [
        '/Users/Test/Documents/My_Video_Project.vid',
        '/Users/Test/Documents/Summer_Vacation_2024.vid',
        '/Users/Test/Documents/Birthday_Party_Edit.vid'
      ];
      setRecentProjects(testProjects);
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
      clips_map: {}, 
      tracks_map: {}, 
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
      await openEditorWindow();
    } catch (error) {
      console.error('Failed to open editor window:', error);
    }
    setIsLoading(false);
    setLoadingProjectTitle(undefined);
  };

  return (
    <>
      <style>{glassStyles}</style>
      {isLoading ? (
        <LoadingScreen 
          onComplete={handleLoadingComplete}
          projectTitle={loadingProjectTitle}
        />
      ) : (
        <div className="min-h-screen bg-zinc-950 font-sans">
          {/* Header with Logo and Buttons */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <img 
              src="/logo.png" 
              alt="Video Editor Logo" 
              className="h-10 w-auto opacity-90 pl-4" 
            />
            
            <div className="flex gap-2">
              <button 
                onClick={() => setModalOpen(true)}
                className="glass-3d-button-primary px-4 py-2 text-white font-medium text-sm relative"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 relative z-10" />
                <span className="relative z-10">Create new</span>
              </button>

              <button 
                onClick={openFlow}
                className="glass-3d-button px-4 py-2 text-white/90 font-medium text-sm relative"
              >
                <FolderOpen className="w-3.5 h-3.5 mr-1.5 relative z-10" />
                <span className="relative z-10">Open project</span>
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto p-4">
            {/* Recent Projects Section with Glass Container */}
            {recentProjects.length > 0 && (
              <div className="glass-card-recent rounded-2xl p-5 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="text-center mb-5">
                    <h2 className="text-lg font-semibold text-white/90 mb-2">Recent Projects</h2>
                    <div className="w-12 h-px bg-white/20 mx-auto"></div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {recentProjects.map((projectPath, index) => (
                      <div
                        key={index}
                        style={{ animationDelay: `${index * 40}ms` }}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-400"
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