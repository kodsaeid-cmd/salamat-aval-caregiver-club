# Login intro video asset

The login-page video is delivered from the same-origin route:

```text
/media/caregiver-club-intro.mp4
```

The Worker streams this route from the private ParsPack object:

```text
organization/public/login-intro/caregiver-club-intro.mp4
```

Delivery characteristics:

- MP4 container
- H.264 video + AAC audio
- `faststart` enabled for progressive web playback
- 16:9 aspect ratio
- 640×360 web rendition
- immutable public browser caching at the same-origin media route
- muted autoplay initially; the user can enable sound from native controls

The login runtime lazy-loads the asset only when the video section enters the viewport and pauses it when the section leaves the viewport.
