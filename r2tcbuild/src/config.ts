/**
 * R2TC Tour app configuration.
 *
 * GOOGLE SHEET SETUP
 * 1. Create a Google Sheet with three tabs named exactly:
 *      TourPoints   (columns: Player | Points)
 *      LongestDrive (columns: Player | Distance | Event)
 *      ClosestToPin (columns: Player | Distance | Event)
 *    Row 1 of each tab is the header row.
 * 2. Click Share -> "Anyone with the link" -> Viewer.
 * 3. Copy the sheet ID from its URL:
 *    https://docs.google.com/spreadsheets/d/THIS_LONG_ID_HERE/edit
 * 4. Paste it below between the quotes and reload the app.
 *
 * While SHEET_ID is empty the app shows sample data.
 */
export const SHEET_ID = '1Z7WRiRNnWrUB_NggjMKqj_6sZwAoimCJo_yulnzLCYo';

export const SHEET_TABS = {
  tourPoints: 'Championship Leaderboard',
  longestDrive: 'Longest Drive Leaderboard',
  closestToPin: 'Closest to the Pin Leaderboard',
  fixtures: 'R2TC FIXTURE',
  handicaps: 'Handicaps',
  scores: 'Scores',
};

export const TOUR_NAME = 'R2TC TOUR';
export const SEASON = '2026';

export const ADMIN_EMAILS = ['andrew@ultimatefs.com.au'];

export const GOLF_API_KEY = 'MAE2WB2DSQEFV5AJZF27UD6L2E';
