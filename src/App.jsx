import { useState, useEffect } from "react";
import "./App.css";
import "bootstrap-icons/font/bootstrap-icons.css";

function App() {
  const [movieName, setMovieName] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // load watchlist from local storage on startup
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("now-showing-watchlist");
    return saved ? JSON.parse(saved) : [];
  });

  // store the streaming availability results for all checked movies
  // format: { [movieId]: [array of UK sources] }
  const [watchlistAvailability, setWatchlistAvailability] = useState({});
  const [batchLoading, setBatchLoading] = useState(false);

  // your UK favourite platforms list
  const [favourites] = useState(["Netflix", "Amazon Prime", "Disney+", "BBC iPlayer", "Now TV", "Apple TV"]);

  const apiKey = import.meta.env.VITE_WATCHMODE_API_KEY;

  // sync watchlist data array to local storage
  useEffect(() => {
    localStorage.setItem("now-showing-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!movieName) return;

    setLoading(true);
    setError("");
    setResults([]);

    const searchField = "name";
    const searchValue = movieName;

    const url = `https://api.watchmode.com/v1/search/?apiKey=${apiKey}&search_field=${searchField}&search_value=${encodeURIComponent(searchValue)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const json = await response.json();

      if (json.title_results && json.title_results.length > 0) {
        setResults(json.title_results);
      } else {
        setError("No movies found matching that title.");
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const trackMovie = (movie) => {
    if (watchlist.some((item) => item.id === movie.id)) {
      alert(`"${movie.name}" is already on your watchlist!`);
      return;
    }
    setWatchlist([...watchlist, movie]);
    setResults([]);
    setMovieName("");
  };

  const untrackMovie = (id) => {
    setWatchlist(watchlist.filter((movie) => movie.id !== id));
    // Clean up availability data for this movie if it exists
    const updatedAvailability = { ...watchlistAvailability };
    delete updatedAvailability[id];
    setWatchlistAvailability(updatedAvailability);
  };

  const checkAllUKAvailability = async () => {
    if (watchlist.length === 0) {
      alert("Your watchlist is empty! Add movies first.");
      return;
    }

    setBatchLoading(true);
    const newAvailabilityResults = {};

    // loop through each movie in your tracking array
    for (const movie of watchlist) {
      const movieId = movie.id;

      const url = `https://api.watchmode.com/v1/title/${movieId}/sources/?apiKey=${apiKey}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const sourcesData = await response.json();
        console.log("source data", sourcesData);
        
        // filter to free and subscription films available on streaming
        const ukStreaming = sourcesData.filter((source) => (source.type === "sub" || source.type === "free") && (source.region === "UK" || source.region === "GB"));

        // save the results map indexed by this specific movie ID
        newAvailabilityResults[movieId] = ukStreaming;
      } catch (err) {
        console.error(`Could not fetch data for ${movie.name}:`, err.message);
        newAvailabilityResults[movieId] = []; // fallback to empty on error
      }
    }

    // save the global data object map to component state
    setWatchlistAvailability(newAvailabilityResults);
    setBatchLoading(false);
  };

  return (
    <div className="container">
      <div id="control_bar">
        <div className="app_title">Now</div>
        <i className="bi bi-camera-reels" id="app_icon"></i>
        <div className="app_title">Showing</div>
      </div>

      {/* SEARCH INTERFACE */}
      <div className="card" id="search_bar">
        <form onSubmit={handleSearch} className="search-form">
          <input id="search_box" type="text" placeholder="Have you heard of..?" value={movieName} onChange={(e) => setMovieName(e.target.value)} />
          <button type="submit" id="search_button">
            Search
          </button>
        </form>
        {loading && <p>Connecting to Watchmode API...</p>}
        {error && <p className="error-text">{error}</p>}

        {results.length > 0 && (
          <ul className="list search-results">
            {results.map((movie) => (
              <li key={movie.id}>
                <span>
                  <strong>{movie.name}</strong> ({movie.year})
                </span>
                <button id="track_button" onClick={() => trackMovie(movie)} className="btn-track">
                  Track
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PERSISTENT WATCHLIST */}
      <div className="card">
        <div id="watchlist_bar">
          <h3>Watchlist</h3>
          {watchlist.length > 0 && (
            <button onClick={checkAllUKAvailability} className="btn-check-all" id="check_movies_button" disabled={batchLoading}>
              {batchLoading ? "Scanning All..." : "Check Availability"}
            </button>
          )}
        </div>

        {watchlist.length === 0 ? (
          <p className="placeholder-text">Not tracking any movies yet. Search and track one above!</p>
        ) : (
          <div className="list">
            {watchlist.map((movie) => {
              const movieSources = watchlistAvailability[movie.id];
              return (
                <div key={movie.id} className="watchlist-item-wrapper">
                  <div className="movie_title">
                    <div>
                      <strong>{movie.name}</strong> <small>({movie.year})</small>
                    </div>
                    <button onClick={() => untrackMovie(movie.id)} className="btn-delete">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>

                  {/* INLINE STREAMING STATUS RESULTS FOR THIS SPECIFIC MOVIE */}
                  {movieSources && (
                    <div className="inline-availability" style={{ marginTop: "2px" }}>
                      {movieSources.length === 0 ? (
                        <p className="alert-box negative" style={{ fontSize: "10px", padding: "2px" }}>
                          Not currently streaming in the UK.
                        </p>
                      ) : (
                        <div className="services-grid">
                          {movieSources.map((source, index) => {
                            const isFavourite = favourites.some((fav) => source.name.toLowerCase().includes(fav.toLowerCase()));
                            return (
                              <div key={index} className={`service-pill ${isFavourite ? "favourite-highlight" : "standard-pill"}`}>
                                <span className="platform-name">{source.name}</span>
                                <span className="badge-type">{source.type === "sub" ? "Subscription" : "Free"}</span>
                                {isFavourite && <span className="fav-star">⭐️ Favourite</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;