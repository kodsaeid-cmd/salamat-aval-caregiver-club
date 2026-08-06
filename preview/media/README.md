# Login intro video asset

Place the optimized login-page video at:

```text
preview/media/caregiver-club-intro.mp4
```

Required delivery characteristics:

- MP4 container
- H.264 video + AAC audio
- `faststart` enabled for progressive web playback
- 16:9 aspect ratio
- recommended web size: 640×360 or 960×540
- muted autoplay is used initially; the user can enable sound from native controls

The login runtime lazy-loads the asset only when the video section enters the viewport and pauses it when the section leaves the viewport.
