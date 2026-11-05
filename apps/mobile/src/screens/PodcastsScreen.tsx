import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, RefreshControl, Image } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { useAuth } from "../context/AuthContext";
import { canCreateContent } from "../utils/roles";
import { ActivityLog } from "../utils/activityLog";
import { Headphones, Play, Pause, Plus, X, Upload, Youtube, FileAudio, ImagePlus, Trash2, Rewind, FastForward, SkipBack, SkipForward, Timer } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";
import TrackPlayer, {
  State as PlayerState,
  usePlaybackState,
  useProgress,
  useActiveTrack,
} from "react-native-track-player";
import {
  setupAudioPlayer,
  playEpisodeQueue,
  togglePlayback,
  seekBy,
  nextRate,
  setSleepTimer,
  getSleepRemainingMin,
} from "../audio/player";
import YoutubePlayer from "react-native-youtube-iframe";
import apiClient, { BASE_URL } from "../api/apiClient";
import { Storage } from "../utils/Storage";
import { getFriendlyErrorMessage } from "../utils/ErrorHandler";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { Cache } from "../utils/Cache";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { extractYouTubeId, youTubeThumbnail } from "../utils/youtube";
import { resolvePlaybackSource, isSampleEpisode } from "../utils/podcasts";

/** Tap-to-seek progress bar (played / buffered / knob). */
const SeekBar = ({ position, duration, buffered }: { position: number; duration: number; buffered: number }) => {
  const [width, setWidth] = useState(0);
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const bufRatio = duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;
  return (
    <View
      style={styles.seekTrack}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(e) => {
        if (width > 0 && duration > 0) {
          TrackPlayer.seekTo(
            Math.max(0, Math.min(1, e.nativeEvent.locationX / width)) * duration
          ).catch(() => {});
        }
      }}
    >
      <View style={[styles.seekBuffered, { width: `${bufRatio * 100}%` }]} />
      <View style={[styles.seekPlayed, { width: `${ratio * 100}%` }]} />
      <View style={[styles.seekKnob, { left: `${ratio * 100}%` }]} />
    </View>
  );
};

export const PodcastsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { user } = useAuth();
  const canCreate = canCreateContent(user?.role);

  const podcastsQuery = useCachedQuery<any[]>("podcasts:list", async () => {
    const res = await apiClient.get("/podcasts").catch(() => null);
    if (res && Array.isArray(res.data)) return res.data.filter((p: any) => !isSampleEpisode(p));
    throw new Error("podcasts unavailable");
  });
  // Real user uploads only; legacy sample episodes are filtered out.
  const podcasts = (podcastsQuery.data || []).filter((p: any) => !isSampleEpisode(p));

  const playbackState = usePlaybackState();
  const progress = useProgress(1000);
  const activeTrack = useActiveTrack();
  const [rate, setRate] = useState(1);
  const [sleepMins, setSleepMins] = useState(0);
  const [youTubeItem, setYouTubeItem] = useState<any | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const playingId = activeTrack ? String(activeTrack.id) : null;
  const isPlaying =
    playbackState.state === PlayerState.Playing ||
    playbackState.state === PlayerState.Buffering;

  // Creation Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [audioMime, setAudioMime] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Background-capable player; the tray notification shows what's on.
    // Nothing is torn down on unmount: audio keeps playing across screens.
    setupAudioPlayer().catch(() => {});
  }, []);

  // Sleep countdown label (the timer itself lives in the player module).
  useEffect(() => {
    if (sleepMins <= 0) return;
    const t = setInterval(() => {
      const left = getSleepRemainingMin();
      setSleepMins(left);
      if (left <= 0) clearInterval(t);
    }, 15000);
    return () => clearInterval(t);
  }, [sleepMins]);

  const playAudio = async (item: any) => {
    const src = resolvePlaybackSource(item);
    if (!src) {
      showNotice({ title: "Unavailable", message: "This episode has no playable audio.", variant: "info" });
      return;
    }
    // YouTube episodes play inside StoryNest (embedded player, no app switch).
    if (src.type === "youtube") {
      ActivityLog.log({ kind: "PODCAST", title: item.title || "episode", sub: "YouTube" });
      setYouTubeItem(item);
      return;
    }
    try {
      if (playingId === item.id) {
        await togglePlayback();
        return;
      }
      // The tapped episode plays first; the rest queue behind it and
      // auto-continue like a playlist.
      const upNext = podcasts
        .filter((p: any) => p.audioUrl && p.id !== item.id)
        .map((p: any) => ({
          id: String(p.id),
          title: p.title,
          blurb: p.blurb,
          audioUrl: p.audioUrl,
          thumbnailUrl: p.thumbnailUrl,
          author: p.author,
        }));
      await playEpisodeQueue(
        {
          id: String(item.id),
          title: item.title,
          blurb: item.blurb,
          audioUrl: src.url,
          thumbnailUrl: item.thumbnailUrl,
          author: item.author,
        },
        upNext
      );
      const q = await TrackPlayer.getQueue().catch(() => []);
      setQueueCount(Math.max(0, q.length - 1));
      ActivityLog.log({ kind: "PODCAST", title: item.title || "episode", sub: item.blurb });
      apiClient.post(`/podcasts/${item.id}/play`).catch(() => {});
    } catch (err: any) {
      showNotice({ title: "Playback Error", message: getFriendlyErrorMessage(err, "Could not play audio episode."), variant: "error" });
    }
  };

  const closePlayer = async () => {
    try {
      await TrackPlayer.reset();
      setQueueCount(0);
    } catch {}
  };

  const cycleRate = async () => {
    try {
      setRate(await nextRate(rate));
    } catch {}
  };

  const cycleSleep = () => {
    const steps = [0, 15, 30, 45, 60];
    const next = steps[(steps.indexOf(sleepMins) + 1) % steps.length] ?? 0;
    setSleepTimer(next);
    setSleepMins(next);
  };

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const ensurePodcastsDir = async () => {
    const dir = `${FileSystem.documentDirectory}podcasts/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    return dir;
  };

  const pickAudioFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const dir = await ensurePodcastsDir();
      const dest = `${dir}${Date.now()}-${asset.name || "audio"}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      setAudioUrl(dest);
      setAudioFileName(asset.name || "audio file");
      setAudioMime((asset as any).mimeType || "audio/mpeg");
      setYoutubeUrl("");
    } catch (e) {
      showNotice({ title: "Error", message: "Could not attach that audio file.", variant: "error" });
    }
  };

  const pickThumbnail = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showNotice({ title: "Permission needed", message: "Allow photo access to pick a thumbnail.", variant: "info" });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const dir = await ensurePodcastsDir();
      const dest = `${dir}thumb-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: res.assets[0].uri, to: dest });
      setThumbnailUrl(dest);
    } catch (e) {
      showNotice({ title: "Error", message: "Could not attach that image.", variant: "error" });
    }
  };

  const handleCreatePodcast = async () => {
    const youtubeId = extractYouTubeId(youtubeUrl.trim());
    if (youtubeUrl.trim() && !youtubeId) {
      showNotice({ title: "Invalid Link", message: "That YouTube link doesn't look right. Please check it.", variant: "info" });
      return;
    }
    if (!title.trim() || (!audioUrl.trim() && !youtubeId)) {
      showNotice({ title: "Required Fields", message: "Enter a title plus an audio file/URL or a YouTube link.", variant: "info" });
      return;
    }
    if (uploading || !tapThrottle("podcasts:publish", TAP_GAP_MS)) return;

    setUploading(true);
    try {
      // Real upload: the audio file travels with the post (fetch sets the
      // multipart boundary itself; axios defaults would break the upload).
      const form = new FormData();
      form.append("title", title.trim());
      if (blurb.trim()) form.append("blurb", blurb.trim());
      const thumb = thumbnailUrl || (youtubeId ? youTubeThumbnail(youtubeId) : "");
      if (thumb) form.append("thumbnailUrl", thumb);
      if (youtubeId) {
        form.append("youtubeUrl", youtubeUrl.trim());
        form.append("youtubeId", youtubeId);
      }
      if (audioFileName) {
        form.append("audio", { uri: audioUrl, name: audioFileName, type: audioMime || "audio/mpeg" } as any);
      } else if (audioUrl.trim()) {
        form.append("audioUrl", audioUrl.trim());
      }
      const token = await Storage.getItem("accessToken");
      const res = await fetch(`${BASE_URL}/podcasts`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const created = await res.json().catch(() => null);
      if (!res.ok || !created || !created.id) {
        throw new Error((created && created.error) || "Upload was rejected. Try a smaller file or a link instead.");
      }

      const next = [created, ...podcasts];
      podcastsQuery.setData(next);
      Cache.set("podcasts:list", next).catch(() => {});
      setTitle("");
      setBlurb("");
      setAudioUrl("");
      setAudioFileName("");
      setAudioMime("");
      setYoutubeUrl("");
      setThumbnailUrl("");
      setShowModal(false);
      showNotice({ title: "Success", message: "Podcast published successfully to the nest!", variant: "success" });
      ActivityLog.log({ kind: "PUBLISH", title: created.title, sub: "podcast" });
    } catch (err: any) {
      showNotice({ title: "Error", message: getFriendlyErrorMessage(err, "Could not upload podcast."), variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteEpisode = (item: any) => {
    showNotice({
      title: "Delete Episode",
      message: `Remove "${item.title}" for everyone?`,
      variant: "error",
      actions: [
        { label: "Cancel", kind: "ghost" },
        {
          label: "Delete",
          kind: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/podcasts/${item.id}`);
              const next = podcasts.filter((p: any) => p.id !== item.id);
              podcastsQuery.setData(next);
              Cache.set("podcasts:list", next).catch(() => {});
            } catch (err: any) {
              showNotice({ title: "Error", message: getFriendlyErrorMessage(err, "Could not delete episode."), variant: "error" });
            }
          },
        },
      ],
    });
  };

  const onRefresh = () => {
    if (!tapThrottle("podcasts:refresh", TAP_GAP_MS)) return;
    podcastsQuery.refresh({ showIndicator: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white, paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Headphones size={28} color={Colors.primary} />
        </View>
        <Text style={[styles.title, { fontFamily: fonts.heading, color: Colors.primary }]}>
          PODCASTS & AUDIO
        </Text>
        {canCreate && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => setShowModal(true)}>
            <Plus size={20} color={theme.white} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + (activeTrack ? 230 : 100),
          paddingTop: 16,
        }}
        refreshControl={<RefreshControl refreshing={podcastsQuery.refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={[styles.body, { fontFamily: fonts.body, color: Colors.mutedTeal }]}>
          Immersive audio stories, author readings, and craft talks from the StoryNest community.
        </Text>

        {podcasts.length === 0 && !podcastsQuery.isFirstLoad && (
          <View style={styles.emptyWrap}>
            <Headphones size={40} color={Colors.mutedTeal} />
            <Text style={[styles.emptyTitle, { fontFamily: fonts.heading, color: theme.primary }]}>No episodes yet</Text>
            <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Real episodes uploaded by writers appear here. Pull down to refresh.</Text>
          </View>
        )}

        {podcasts.map((s) => {
          const isCurrent = playingId === s.id;
          return (
            <View key={s.id} style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.paleGreen }]}>
              {s.thumbnailUrl ? (
                <Image source={{ uri: s.thumbnailUrl }} style={styles.thumb} />
              ) : null}
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.cardTitle, { fontFamily: fonts.heading, color: theme.primary }]}>
                  {s.title}
                </Text>
                <Text style={[styles.cardBlurb, { fontFamily: fonts.body }]}>{s.blurb}</Text>
                <Text style={styles.authorText}>By {s.author || 'StoryNest Author'}</Text>
              </View>
              {s.authorId && user?.id === s.authorId && (
                <TouchableOpacity onPress={() => confirmDeleteEpisode(s)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color={Colors.mutedTeal} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: Colors.primary }]}
                onPress={() => playAudio(s)}
              >
                {isCurrent && isPlaying ? (
                  <Pause size={18} color={Colors.accent} />
                ) : !s.audioUrl && (s.youtubeUrl || s.youtubeId) ? (
                  <Youtube size={18} color={Colors.accent} />
                ) : (
                  <Play size={18} color={Colors.accent} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Upload Podcast Modal */}
      <Modal visible={showModal && canCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.primary }]}>Upload Audio Episode</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><X size={22} color={theme.black} /></TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { color: theme.black, fontFamily: fonts.body, borderColor: 'rgba(0,54,49,0.2)' }]}
              placeholder="Episode Title"
              placeholderTextColor={Colors.mutedTeal}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.input, { color: theme.black, fontFamily: fonts.body, borderColor: 'rgba(0,54,49,0.2)' }]}
              placeholder="Description / Blurb"
              placeholderTextColor={Colors.mutedTeal}
              value={blurb}
              onChangeText={setBlurb}
            />

            <TextInput
              style={[styles.input, { color: theme.black, fontFamily: fonts.body, borderColor: 'rgba(0,54,49,0.2)' }]}
              placeholder="Audio URL (e.g. .mp3 link)"
              placeholderTextColor={Colors.mutedTeal}
              value={audioFileName || audioUrl}
              onChangeText={setAudioUrl}
              editable={!audioFileName}
            />
            {!!audioFileName && (
              <TouchableOpacity
                onPress={() => { setAudioFileName(""); setAudioUrl(""); setAudioMime(""); }}
                style={styles.clearFileBtn}
              >
                <Text style={[styles.clearFileText, { fontFamily: fonts.body }]}>Remove attached file, use URL instead</Text>
              </TouchableOpacity>
            )}

            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={pickAudioFile} activeOpacity={0.8}>
                <FileAudio size={18} color={Colors.primary} />
                <Text style={[styles.pickBtnText, { fontFamily: fonts.heading, color: theme.primary }]}>AUDIO FILE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={pickThumbnail} activeOpacity={0.8}>
                <ImagePlus size={18} color={Colors.primary} />
                <Text style={[styles.pickBtnText, { fontFamily: fonts.heading, color: theme.primary }]}>THUMBNAIL</Text>
              </TouchableOpacity>
            </View>
            {!!thumbnailUrl && (
              <Image source={{ uri: thumbnailUrl }} style={styles.thumbPreview} />
            )}

            <TextInput
              style={[styles.input, { color: theme.black, fontFamily: fonts.body, borderColor: 'rgba(0,54,49,0.2)' }]}
              placeholder="YouTube link (if no audio file)"
              placeholderTextColor={Colors.mutedTeal}
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.uploadActionBtn, { backgroundColor: Colors.primary, opacity: uploading ? 0.6 : 1 }]}
              onPress={handleCreatePodcast}
              disabled={uploading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Upload size={18} color={Colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.uploadBtnText, { fontFamily: fonts.heading }]}>{uploading ? "Publishing..." : "Publish Episode"}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* In-app YouTube player (never leaves StoryNest) */}
      <Modal visible={!!youTubeItem} animationType="slide" transparent onRequestClose={() => setYouTubeItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.primary }]} numberOfLines={1}>
                {youTubeItem?.title || "YouTube Episode"}
              </Text>
              <TouchableOpacity onPress={() => setYouTubeItem(null)}><X size={22} color={theme.black} /></TouchableOpacity>
            </View>
            {(() => {
              const ytId = youTubeItem ? (extractYouTubeId(youTubeItem.youtubeUrl) || youTubeItem.youtubeId) : null;
              return ytId ? <YoutubePlayer height={220} videoId={ytId} play /> : null;
            })()}
            {!!youTubeItem?.blurb && (
              <Text style={[styles.cardBlurb, { fontFamily: fonts.body, marginTop: 12 }]}>{youTubeItem.blurb}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Persistent player: seek, speed, sleep, queue (keeps playing anywhere) */}
      {activeTrack && (
        <View style={[styles.playerBar, { backgroundColor: isDarkMode ? "#12211F" : Colors.white, paddingBottom: insets.bottom + 12 }]}>
          <SeekBar position={progress.position} duration={progress.duration} buffered={progress.buffered} />
          <View style={styles.playerTopRow}>
            {!!activeTrack.artwork && (
              <Image source={{ uri: String(activeTrack.artwork) }} style={styles.playerThumb} />
            )}
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.playerTitle, { fontFamily: fonts.heading, color: theme.primary }]} numberOfLines={1}>
                {activeTrack.title || "Episode"}
              </Text>
              <Text style={[styles.playerSub, { fontFamily: fonts.body }]}>
                {fmtTime(progress.position)} / {fmtTime(progress.duration)}
                {queueCount > 0 ? `  •  ${queueCount} up next` : ""}
              </Text>
            </View>
            <TouchableOpacity style={styles.rateBtn} onPress={cycleRate}>
              <Text style={[styles.rateText, { fontFamily: fonts.heading, color: theme.primary }]}>{rate}×</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={cycleSleep}>
              <Timer size={20} color={sleepMins > 0 ? Colors.primary : Colors.mutedTeal} />
              {sleepMins > 0 && (
                <Text style={[styles.sleepText, { fontFamily: fonts.body }]}>{sleepMins}m</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={closePlayer}>
              <X size={20} color={Colors.mutedTeal} />
            </TouchableOpacity>
          </View>
          <View style={styles.playerControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => seekBy(-15).catch(() => {})}>
              <Rewind size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => TrackPlayer.skipToPrevious().catch(() => {})}>
              <SkipBack size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playPauseBtn, { backgroundColor: Colors.primary }]} onPress={() => togglePlayback().catch(() => {})}>
              {isPlaying ? <Pause size={24} color={Colors.accent} /> : <Play size={24} color={Colors.accent} style={{ marginLeft: 2 }} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => TrackPlayer.skipToNext().catch(() => {})}>
              <SkipForward size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => seekBy(15).catch(() => {})}>
              <FastForward size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,54,49,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, letterSpacing: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 14, lineHeight: 22, marginBottom: 24, marginTop: 12 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,54,49,0.1)',
  },
  cardTitle: { fontSize: 15, letterSpacing: 0.5, marginBottom: 6 },
  cardBlurb: { fontSize: 13, color: Colors.mutedTeal, lineHeight: 18, marginBottom: 8 },
  authorText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { padding: 8, marginRight: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.mutedTeal, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,54,49,0.25)', borderRadius: 12,
    paddingVertical: 14, gap: 8,
  },
  pickBtnText: { fontSize: 12, letterSpacing: 1 },
  clearFileBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  clearFileText: { fontSize: 12, color: Colors.mutedTeal, textDecorationLine: 'underline' },
  thumbPreview: { width: 72, height: 72, borderRadius: 12, marginBottom: 16 },
  thumb: { width: 56, height: 56, borderRadius: 12, marginRight: 14 },
  uploadActionBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  uploadBtnText: { color: Colors.accent, fontSize: 14, letterSpacing: 1 },
  playerBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 8,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "rgba(0,54,49,0.12)",
    elevation: 12,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: -4 },
  },
  playerTopRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  playerThumb: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  playerTitle: { fontSize: 14 },
  playerSub: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  rateBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(0,54,49,0.08)" },
  rateText: { fontSize: 13 },
  iconBtn: { padding: 8, alignItems: "center" },
  sleepText: { fontSize: 10, color: Colors.primary, marginTop: 1 },
  playerControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", marginTop: 8 },
  ctrlBtn: { padding: 10 },
  playPauseBtn: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  seekTrack: { height: 24, justifyContent: "center" },
  seekBuffered: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: "rgba(0,54,49,0.15)" },
  seekPlayed: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  seekKnob: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, marginLeft: -6 },
});
