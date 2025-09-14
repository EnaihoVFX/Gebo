import { invoke } from '@tauri-apps/api/core';

export interface WindowSize {
  width: number;
  height: number;
}

export const WINDOW_SIZES = {
  HOME: { width: 800, height: 600 },
  EDITOR: { width: 1280, height: 800 }
} as const;

export async function resizeWindow(size: WindowSize): Promise<void> {
  try {
    await invoke('resize_window', { 
      width: size.width, 
      height: size.height 
    });
  } catch (error) {
    console.error('Failed to resize window:', error);
  }
}

export async function centerWindow(): Promise<void> {
  try {
    await invoke('center_window');
  } catch (error) {
    console.error('Failed to center window:', error);
  }
}

export async function setFullscreen(fullscreen: boolean): Promise<void> {
  try {
    await invoke('set_fullscreen', { fullscreen });
  } catch (error) {
    console.error('Failed to set fullscreen:', error);
  }
}

export async function expandToEditorSize(): Promise<void> {
  // First resize to editor size
  await resizeWindow(WINDOW_SIZES.EDITOR);
  
  // Then center the window
  await centerWindow();
  
  // Small delay to ensure smooth transition
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function expandToFullscreen(): Promise<void> {
  // Set the window to fullscreen mode
  await setFullscreen(true);
}

export async function returnToHomeSize(): Promise<void> {
  // Exit fullscreen first
  await setFullscreen(false);
  
  // Small delay to ensure fullscreen exit completes
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Resize to home size
  await resizeWindow(WINDOW_SIZES.HOME);
  
  // Center the window
  await centerWindow();
}

export async function openEditorWindow(): Promise<void> {
  try {
    console.log('Attempting to create editor window...');
    await invoke('create_editor_window');
    console.log('Editor window created successfully');
  } catch (error) {
    console.error('Failed to create editor window:', error);
    throw error; // Re-throw to let the caller handle it
  }
}
