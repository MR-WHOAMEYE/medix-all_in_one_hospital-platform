# MediX UI capture kit

Captures the **real deployed React UI** in Chromium using Puppeteer. It does not redraw or replace the login screen.

## 1. Install

```bash
cd video-capture
npm install
```

Puppeteer normally downloads a compatible Chrome for Testing. If using system Chromium, set `CHROME_BIN` to its executable path.

## 2. Capture the public login screen

```bash
npm run capture
```

Default target: https://medix-15sd.vercel.app

Outputs are written to `video-capture/captures/`:
- `01-login.png` — browser screenshot at 1920×1080
- `01-login.svg` — SVG wrapper embedding the exact PNG pixels
- `capture-manifest.json` — capture metadata

The SVG is a pixel-preserving wrapper, **not** a vectorized or editable recreation of the React interface. A screenshot cannot be converted losslessly into separate text, buttons, and DNA-helix vector layers.

## 3. Capture authenticated screens

Use an account you are authorized to access. Credentials are read from environment variables, not stored in the repository.

macOS/Linux:
```bash
MEDIX_EMAIL='your-account@example.com' MEDIX_PASSWORD='your-password' npm run capture
```

PowerShell:
```powershell
$env:MEDIX_EMAIL = 'your-account@example.com'
$env:MEDIX_PASSWORD = 'your-password'
npm run capture
```

This captures routes allowed by the signed-in account's role. Run separately for admin, doctor, nurse, and patient accounts to collect each role's screens; set a different `OUT_DIR` for each run so files are not mixed. Never commit credentials, cookies, tokens, or captured patient data.

## Notes

- The first capture is the actual login screen, including the current DNA helix and branding.
- The script waits for the app to settle before capture; live network data can make screenshots vary.
- If authentication requires OTP, CAPTCHA, or a different flow, complete it manually in a local browser and adapt the script rather than bypassing the control.
- Captures are made only when you run the script in an environment with internet access. This ChatGPT execution environment could not reach the deployed site, so no screenshot files have been generated here.


## 4. Export live React pages as layered SVG

This exports the live rendered DOM and accessible visible controls into SVG files. It does **not** convert the source JSX syntax itself; it renders the real app in Chromium, embeds the rendered HTML/CSS using SVG `foreignObject`, and adds individually addressable SVG hit-target groups for visible buttons, links, fields, and role buttons.

Install and run from this directory:

```bash
npm install
npm run convert-svg
```

Output: `video-capture/svg-pages/` with `public-login.svg`, per-role SVGs, and `manifest.json`.

For authenticated role screens, set the credentials for accounts you are authorized to use. PowerShell example:

```powershell
$env:MEDIX_ADMIN_EMAIL = 'your-admin-account@example.com'
$env:MEDIX_ADMIN_PASSWORD = 'your-password'
$env:MEDIX_DOCTOR_EMAIL = 'your-doctor-account@example.com'
$env:MEDIX_DOCTOR_PASSWORD = 'your-password'
$env:MEDIX_NURSE_EMAIL = 'your-nurse-account@example.com'
$env:MEDIX_NURSE_PASSWORD = 'your-password'
$env:MEDIX_PATIENT_EMAIL = 'your-patient-account@example.com'
$env:MEDIX_PATIENT_PASSWORD = 'your-password'
npm run convert-svg
```

Do not commit credentials or real patient data. You can set `OUT_DIR`, `MEDIX_URL`, `WIDTH`, `HEIGHT`, and `WAIT_MS` to adjust the export.

**Important renderer limitation:** SVG `foreignObject` preserves HTML/CSS appearance in compatible browsers and tools, but it is not a pure vector conversion of every CSS/Three.js effect. The transparent SVG hit targets are independently named and selectable for editing/shot planning; cloning a React DOM does not preserve React event handlers, so the exported SVG is a visual/cinematic asset rather than a fully functioning copy of the web application. Use the live app for real authentication and data actions. Test the SVG in the intended video/editor pipeline because some tools flatten or ignore `foreignObject`.


## 5. Validate exported SVG files

After generating the SVGs, run:

```bash
npm run validate-svg
```

The validator checks XML parsing, SVG root/dimensions, embedded `foreignObject`, hotspot groups, and attempts to render each SVG in Chromium. It writes `svg-pages/validation-report.json` and PNG previews to `svg-pages/validation-previews/`. Open the PNG previews to visually inspect layout, fonts, images, and clipping. A syntactically valid SVG can still look wrong in an editor that does not support `foreignObject`.
