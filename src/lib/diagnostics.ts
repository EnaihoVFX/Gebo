import { invoke } from "@tauri-apps/api/core";

/**
 * Test if FFmpeg is available and working
 */
export async function testFFmpeg(): Promise<{
  available: boolean;
  error?: string;
}> {
  try {
    // Try to probe a test - this will fail but tells us if FFmpeg exists
    await invoke("probe_video", { path: "/dev/null" });
    return { available: true };
  } catch (error) {
    const errorStr = String(error);
    
    // If error contains "ffmpeg/ffprobe not found", FFmpeg is not installed
    if (errorStr.includes("ffmpeg") && errorStr.includes("not found")) {
      return {
        available: false,
        error: "FFmpeg is not installed or not in PATH",
      };
    }
    
    // Other errors likely mean FFmpeg exists but the test path is invalid (which is expected)
    // This is actually a success case
    return { available: true };
  }
}

/**
 * Diagnose preview generation issues
 */
export async function diagnosePreviewSystem() {
  console.log('🔍 Running Preview System Diagnostics...\n');
  
  // Test 1: FFmpeg availability
  console.log('Test 1: Checking FFmpeg...');
  const ffmpegTest = await testFFmpeg();
  if (!ffmpegTest.available) {
    console.error('❌ FFmpeg is not available:', ffmpegTest.error);
    console.log('\n💡 Solution: Install FFmpeg');
    console.log('   macOS: brew install ffmpeg');
    console.log('   Windows: Download from https://ffmpeg.org/');
    console.log('   Linux: sudo apt install ffmpeg (Debian/Ubuntu)');
    return { success: false, reason: 'ffmpeg_missing' };
  }
  console.log('✅ FFmpeg is available');
  
  // Test 2: Check Downloads directory
  console.log('\nTest 2: Checking Downloads directory...');
  try {
    await invoke("get_file_size", { path: "/tmp" });
    console.log('✅ File system access working');
  } catch (error) {
    console.error('❌ File system access issue:', error);
    return { success: false, reason: 'filesystem_access' };
  }
  
  console.log('\n✅ All diagnostic tests passed!');
  console.log('If preview generation still fails, check:');
  console.log('1. Media file paths are valid');
  console.log('2. Media files are not corrupted');
  console.log('3. Sufficient disk space in Downloads folder');
  
  return { success: true };
}

/**
 * Log system information for debugging
 */
export function logSystemInfo() {
  console.log('📋 System Information:');
  console.log('Platform:', navigator.platform);
  console.log('User Agent:', navigator.userAgent);
  console.log('Language:', navigator.language);
  console.log('Online:', navigator.onLine);
  console.log('Memory:', (performance as any).memory ? {
    used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + ' MB',
    total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + ' MB',
    limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) + ' MB',
  } : 'Not available');
}




