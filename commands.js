//import example from './commands/example.js';
import albumDates from './commands/albumDates.js';
import findOutOfAlbumPhotos from './commands/findOutOfAlbumPhotos.js';
import findOutOfAlbumPhotosWithThumbnail from './commands/findOutOfAlbumPhotosWithThumbnail.js';

export default [

	albumDates,
	findOutOfAlbumPhotos,
	findOutOfAlbumPhotosWithThumbnail

].flat(); // Individual commands imports may return arrays of commands, flatten them here.