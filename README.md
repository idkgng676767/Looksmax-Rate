# LooksScore Terminal

A browser-based facial attractiveness scoring tool powered by Google's MediaPipe Face Mesh. Upload a front-facing photo and get a deterministic 1-10 rating across 8 facial metrics — no randomness, pure math.

**Live demo:** https://idkgng676767.github.io/Looksmax-Rate/

## How It Works

1. **Upload** a front-facing photo (JPG / PNG / WEBP)
2. **MediaPipe Face Mesh** detects 468 facial landmarks
3. **Landmark Map** lets you review and correct any misplaced dots by dragging them
4. **Analysis** computes 8 sub-metrics and produces a final score

## Scoring Metrics

| Metric | Weight | What it measures |
|---|---|---|
| Jawline | 21% | Face height-to-width ratio (square face = higher) |
| Symmetry | 18% | Mirror deviation of paired landmarks across nose bridge |
| Canthal Tilt | 17% | Eye corner angle (positive = "hunter" gaze) |
| Cheekbones | 14% | Cheek width vs jaw width ratio |
| Eye Region | 12% | Eye aspect ratio (height vs width) |
| Facial Proportions | 10% | Deviation from equal thirds (brow-nose-chin) |
| Nose | 5% | Nose width vs inter-eye distance |
| Lips | 3% | Upper-to-lower lip height ratio |

## Technical Details

- **Engine:** MediaPipe Face Mesh via CDN (`@mediapipe/face_mesh`)
- **Landmarks:** 468 points, single face detection
- **Head-tilt compensation:** All landmarks are rotated so the eye line is horizontal before measurement
- **Coordinate system:** Image-normalized (0-1 range), not face-normalized
- **Score formula:** Weighted sum of sub-metrics, mapped to 2.0-9.7 range
- **Zero randomness:** Same photo always produces the same score

## File Structure

```
Looksmax-Rate/
├── index.html          # Main app (all-in-one HTML/CSS/JS)
├── calibrate.html      # Standalone landmark calibration/debug tool
├── debug.html          # Debug page for testing formulas
├── _newjs.js           # Work-in-progress JS refactor
└── README.md           # This file
```

## Landmark Correction

After detection, you can drag any of the 27 key landmark dots to correct misplacements. Corrected dots turn cyan. This is the main way to improve accuracy — if MediaPipe places a dot wrong, fix it and re-analyze.

Key landmarks you can correct:
- Jaw (left, right, chin, mid-left, mid-right)
- Eyes (outer, inner, top, bottom for each side)
- Eyebrows (outer, inner for each side)
- Nose (tip, left, right, bridge)
- Lips (top, bottom, left, right)
- Cheeks (left, right)
- Forehead

## Score Tiers

| Score | Tier |
|---|---|
| < 4.0 | Subhuman |
| 4.0 - 4.9 | Below Average |
| 5.0 - 5.9 | Average |
| 6.0 - 6.9 | Above Average |
| 7.0 - 7.9 | High Tier |
| 8.0 - 8.9 | Chad |
| 9.0+ | Gigachad |

## Looksmax Tips

The app generates personalized improvement tips based on your weakest metrics. Tips reference proven methods like bodyfat reduction, mewing, proper sleep, and orthodontics.

## Requirements

- Modern browser with WebGL support
- Webcam not needed (photo upload only)
- Front-facing photo with good lighting for best results
- Face should take up 40%+ of the frame
- No glasses, masks, or heavy filters

## Known Issues

- Sub-metric scores can read low (15-40%) for normal faces due to aggressive formula scaling — this is a calibration issue being actively worked on
- Browser caching may require hard refresh (Cmd+Shift+R) after updates
- MediaPipe CDN must be accessible (no offline support)

## Development

The app is a single 570-line HTML file. No build step, no npm, no framework. Just open `index.html` in a browser or serve it with any static server.

```bash
# Quick local server
cd Looksmax-Rate && python3 -m http.server 8080
```

## Version History

- **v5.1** — Current. Head-tilt compensation, rewritten all 8 metric formulas, landmark correction UI, debug output on results page
- Earlier versions — Formula calibration iterations, symmetry/nose/lips curve adjustments

## License

This is a personal project. Use it however you want.
