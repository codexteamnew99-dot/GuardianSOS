// extends app.json: injects the Android Google Maps key from the environment so a
// dev/production build can render the in-app map without editing app.json
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: process.env.GOOGLE_MAPS_API_KEY
      ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
      : config.android?.config,
  },
});
