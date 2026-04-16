// Platform-agnostic entry point
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  module.exports = require('./live-tracking.web.tsx');
} else {
  module.exports = require('./live-tracking.native.tsx');
}
