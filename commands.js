//import example from './commands/example.js';
import albumDates from './commands/albumDates.js';
import findOutOfAlbumPhotos from './commands/findOutOfAlbumPhotos.js';

export default [

	albumDates,
	findOutOfAlbumPhotos

].flat(); // Individual commands imports may return arrays of commands, flatten them here.