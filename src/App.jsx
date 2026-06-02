import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [movieName, setMovieName] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load watchlist from Local Storage on startup
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("now-showing-watchlist");
    return saved ? JSON.parse(saved) : [];
  });

  // Store the streaming availability results for all checked movies
  // Format will be: { [movieId]: [array of UK sources] }
  const [watchlistAvailability, setWatchlistAvailability] = useState({});
  const [batchLoading, setBatchLoading] = useState(false);

  // Your UK favourite platforms list
  const [favourites] = useState(["Netflix", "Amazon Prime", "Disney+", "BBC iPlayer", "Now TV", "Apple TV"]);

  const apiKey = import.meta.env.VITE_WATCHMODE_API_KEY;

  // Sync watchlist data array to local storage
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

  // ➡️ UPDATED BATCH FUNCTION USING YOUR EXACT SPECIFIED URL STRING STRATEGY
  const checkAllUKAvailability = async () => {
    if (watchlist.length === 0) {
      alert("Your watchlist is empty! Add movies first.");
      return;
    }

    setBatchLoading(true);
    const newAvailabilityResults = {};

    // Loop through each movie in your tracking array
    for (const movie of watchlist) {
      const movieId = movie.id;

      // ➡️ YOUR EXACT SPECIFIED STRING RUNNING WITHOUT MODIFICATIONS
      const url = `https://api.watchmode.com/v1/title/${movieId}/sources/?apiKey=${apiKey}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const sourcesData = await response.json();

        // Keep free/subscription options and isolate to the UK region entries
        const ukStreaming = sourcesData.filter((source) => (source.type === "sub" || source.type === "free") && (source.region === "UK" || source.region === "GB"));

        // Save the results map indexed by this specific movie ID
        newAvailabilityResults[movieId] = ukStreaming;
      } catch (err) {
        console.error(`Could not fetch data for ${movie.name}:`, err.message);
        newAvailabilityResults[movieId] = []; // Fallback to empty on error
      }
    }

    // Save the global data object map to component state
    setWatchlistAvailability(newAvailabilityResults);
    setBatchLoading(false);
  };

  return (
    <div className="container">
      <h1>🎬 Now Showing</h1>

      {/* SEARCH INTERFACE */}
      <div className="card">
        <h3>Find a Film</h3>
        <form onSubmit={handleSearch} className="search-form">
          <input type="text" placeholder="Have you heard of..?" value={movieName} onChange={(e) => setMovieName(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        {loading && <p>Connecting to Watchmode API...</p>}
        {error && <p className="error-text">⚠️ {error}</p>}

        {results.length > 0 && (
          <ul className="list search-results">
            {results.map((movie) => (
              <li key={movie.id}>
                <span>
                  <strong>{movie.name}</strong> ({movie.year})
                </span>
                <button onClick={() => trackMovie(movie)} className="btn-track">
                  ➕ Track
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PERSISTENT WATCHLIST */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eaeaea", paddingBottom: "8px" }}>
          <h3 style={{ margin: 0, border: "none" }}>Your Saved Watchlist</h3>
          {watchlist.length > 0 && (
            <button onClick={checkAllUKAvailability} className="btn-check-all" disabled={batchLoading} style={{ background: "#17a2b8", color: "white" }}>
              {batchLoading ? "🔄 Scanning All..." : "🔍 Check All Movies"}
            </button>
          )}
        </div>

        {watchlist.length === 0 ? (
          <p className="placeholder-text">Not tracking any movies yet. Search and track one above!</p>
        ) : (
          <ul className="list">
            {watchlist.map((movie) => {
              const movieSources = watchlistAvailability[movie.id];
              return (
                <li key={movie.id} className="watchlist-item-wrapper" style={{ display: "block", borderBottom: "1px solid #eee", padding: "15px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{movie.name}</strong> <small>({movie.year})</small>
                    </div>
                    <button onClick={() => untrackMovie(movie.id)} className="btn-delete">
                      ❌
                    </button>
                  </div>

                  {/* INLINE STREAMING STATUS RESULTS FOR THIS SPECIFIC MOVIE */}
                  {movieSources && (
                    <div className="inline-availability" style={{ marginTop: "10px" }}>
                      {movieSources.length === 0 ? (
                        <p className="alert-box negative" style={{ fontSize: "13px", padding: "6px" }}>
                          Not streaming on standard UK subscription formats right now.
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;