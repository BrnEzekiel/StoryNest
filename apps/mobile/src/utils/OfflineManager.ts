import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;
const OFFLINE_INDEX_KEY = 'offline_stories_index';

interface OfflineStory {
    id: string;
    title: string;
    body: string;
    authorName: string;
    genre: string;
    coverUrl: string;
    localCoverPath: string;
    downloadedAt: string;
}

export const OfflineManager = {
    /**
     * Initialize downloads directory
     */
    init: async () => {
        const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
        }
    },

    /**
     * Download a story for offline use
     */
    downloadStory: async (story: any) => {
        await OfflineManager.init();

        const localCoverPath = `${DOWNLOADS_DIR}${story.id}_cover.jpg`;
        
        try {
            // 1. Download cover image
            if (story.coverUrl) {
                await FileSystem.downloadAsync(story.coverUrl, localCoverPath);
            }

            // 2. Prepare offline record
            const offlineStory: OfflineStory = {
                ...story,
                localCoverPath: story.coverUrl ? localCoverPath : '',
                downloadedAt: new Date().toISOString()
            };

            // 3. Save to index
            const indexStr = await AsyncStorage.getItem(OFFLINE_INDEX_KEY);
            const index = indexStr ? JSON.parse(indexStr) : [];
            
            // Remove existing if any
            const newIndex = index.filter((s: any) => s.id !== story.id);
            newIndex.push(offlineStory);
            
            await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(newIndex));
            return true;
        } catch (e) {
            console.error("[OfflineManager] Download failed:", e);
            return false;
        }
    },

    /**
     * Get all downloaded stories
     */
    getDownloadedStories: async (): Promise<OfflineStory[]> => {
        const indexStr = await AsyncStorage.getItem(OFFLINE_INDEX_KEY);
        return indexStr ? JSON.parse(indexStr) : [];
    },

    /**
     * Remove a downloaded story
     */
    removeStory: async (storyId: string) => {
        const indexStr = await AsyncStorage.getItem(OFFLINE_INDEX_KEY);
        if (!indexStr) return;

        let index = JSON.parse(indexStr);
        const story = index.find((s: any) => s.id === storyId);

        if (story && story.localCoverPath) {
            await FileSystem.deleteAsync(story.localCoverPath, { idempotent: true });
        }

        const newIndex = index.filter((s: any) => s.id !== storyId);
        await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(newIndex));
    },

    /**
     * Check if a story is downloaded
     */
    isDownloaded: async (storyId: string) => {
        const index = await OfflineManager.getDownloadedStories();
        return index.some(s => s.id === storyId);
    }
};
