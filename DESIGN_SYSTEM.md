# NetPulse Mac App — DESIGN_SYSTEM.md

**Vision:** The network tool a hacker would actually use. Not a dashboard — an instrument.
**References:** Little Snitch UI, Raycast, Linear's density, TRON
**Personality:** Dark, precise, premium — every number means something

## Colors
- Background: #080809 (darker than web version)
- Surface: #0F0F12
- Surface raised: #161619
- Border: rgba(255,255,255,0.07)
- Accent: #00E5FF (slightly different cyan — not clashing with web)
- Success: #00FF87
- Warning: #FFAA00
- Danger: #FF4455
- Text primary: rgba(255,255,255,0.92)
- Mono: JetBrains Mono — ALL data, numbers, IPs, speeds

## Design prompt library components to use:
1. Liquid Glass Button (from prompt library) — primary CTAs
2. Metal Button (from prompt library) — secondary actions
3. CpuArchitecture SVG (from prompt library) — loading states
4. NeonButton style — status indicators

## Tauri-specific
- Window: 900×620, no native titlebar (custom), transparent=false
- macOS vibrancy: NOT used (too heavy) — pure dark instead
- Frameless window with custom drag region

## Layout — SINGLE SCREEN, no navigation

Zone 1 (top, 30%): VELOCITY — Speed gauges + live graph
Zone 2 (left 40%, 70% height): SHIELD — VPN status + connection info  
Zone 3 (right 60%, 70% height): FLOW — Traffic + process breakdown
