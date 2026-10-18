import { Config } from '@remotion/cli/config';

// SVG exports live one directory above this Remotion project.
Config.setPublicDir('../');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
