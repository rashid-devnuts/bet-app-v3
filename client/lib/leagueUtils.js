// Simple utility to get Fotmob logo URL from Unibet league ID
// Based on league_mapping_clean.csv
// Auto-generated - DO NOT EDIT MANUALLY (will be overwritten by league mapping job)

const UNIBET_TO_FOTMOB_MAPPING = {
  '1000123032': '289', // Africa Cup of Nations (International)
  '1000257492': '127', // Ligat Ha'Al (Israel)
  '2000056761': '524', // Premier League (Iraq)
  '1000254606': '529', // Premier League (Kuwait)
  '2000050125': '116', // Premier League (Wales)
  '1000250591': '536', // Professional League (Saudi Arabia)
};

export const getFotmobLogoByUnibetId = (unibetId) => {
  if (!unibetId) {
    return null;
  }
  
  const fotmobId = UNIBET_TO_FOTMOB_MAPPING[String(unibetId)];
  
  if (!fotmobId) {
    return null;
  }
  
  const url = `https://images.fotmob.com/image_resources/logo/leaguelogo/${fotmobId}.png`;
  return url;
};
