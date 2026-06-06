import { useState, useEffect } from "react";
import "./App.css";
import "bootstrap-icons/font/bootstrap-icons.css";

function App() {
  const [movieName, setMovieName] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [includeRentals, setRentalFlag] = useState(false);

  const sourcesList = ["Amazon", "Apple TV", "BBC iPlayer", "BFI Player", "Curzon Home Cinema", "Disney+", "Mubi", "Netflix", "Shudder", "Sky Store"];

  // tracks saved liked/loved/disliked settings
  const [sourcePreferences, setSourcePreferences] = useState(() => {
    const saved = localStorage.getItem("uk_source_preferences");
    return saved ? JSON.parse(saved) : {};
  });

  // controls whether the gear menu dropdown is open or closed
  const [showSettings, setShowSettings] = useState(false);

  // save settings to the browser memory whenever a radio button changes
  useEffect(() => {
    localStorage.setItem("uk_source_preferences", JSON.stringify(sourcePreferences));
  }, [sourcePreferences]);

  // update a single platform's preference without affecting the others
  const handlePreferenceChange = (sourceName, status) => {
    setSourcePreferences((prev) => ({
      ...prev,
      [sourceName.toLowerCase()]: status,
    }));
  };

  // load watchlist from local storage on startup
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("now-showing-watchlist");
    return saved ? JSON.parse(saved) : [];
  });

  // store the streaming availability results for all checked movies
  // format: { [movieId]: [array of UK sources] }
  const [watchlistAvailability, setWatchlistAvailability] = useState({});
  const [batchLoading, setBatchLoading] = useState(false);

  const apiKey = import.meta.env.VITE_WATCHMODE_API_KEY;

  const getSources = async () => {
    const urlSources = `https://api.watchmode.com/v1/sources/?apiKey=${apiKey}&regions=UK,GB`;

    const response = await fetch(urlSources);
    const jsonSources = await response.json();
    console.log("sources", jsonSources);
  };

  getSources();

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
        console.log("results", json.title_results);
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
        const ukStreaming = sourcesData.filter((source) => {
          const isValidType = source.type === "sub" || source.type === "free" || (includeRentals && source.type === "rent");
          const isValidRegion = source.region === "UK" || source.region === "GB";

          return isValidType && isValidRegion;
        });

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

  // close pop up menu if user clicks outside menu while it's open
  useEffect(() => {
    const closeMenu = (e) => {
      // if the click came from the gear button or inside the menu, do nothing
      if (e.target.closest(".control-gear-btn") || e.target.closest(".global-sources-menu")) {
        return;
      }
      // otherwise, close the menu
      setShowSettings(false);
    };

    if (showSettings) {
      window.addEventListener("click", closeMenu);
    }

    return () => window.removeEventListener("click", closeMenu);
  }, [showSettings]);

  return (
    <div className="container">
      <div id="control_bar">
        <div className="app_title">NOW SH</div>
        <i className="bi bi-tv" id="app_icon"></i>
        <div className="app_title">WING</div>

        {/* gear icon button toggles the settings panel */}
        <button className="control-gear-btn" onClick={() => setShowSettings(!showSettings)} aria-label="Toggle Source Settings">
          <i className="bi bi-gear-fill"></i>
        </button>

        {/* pop-out menu for UK services from sourcesList */}
        {showSettings && (
          <div className="global-sources-menu">
            <h4>Preferred Services</h4>
            <div className="menu-sources-list">
              {sourcesList.map((sourceName) => {
                const sourceKey = sourceName.toLowerCase();
                const currentPref = sourcePreferences[sourceKey] || "liked";

                return (
                  <div key={sourceName} className="menu-source-item">
                    <span className="menu-source-name">{sourceName}</span>
                    <div className="radio-group">
                      {[
                        { value: "liked", icon: "bi-hand-thumbs-up" },
                        { value: "disliked", icon: "bi-hand-thumbs-down" },
                        { value: "loved", icon: "bi-heart" },
                      ].map((option) => {
                        const isSelected = currentPref === option.value;

                        // use the filled heart icon specifically if loved and active
                        let iconClass = option.value === "loved" && isSelected ? "bi-heart-fill" : option.icon;
                        
                        return (
                          <label key={option.value} className={`icon-radio-label ${isSelected ? "selected" : "unselected"}`} title={option.value.charAt(0).toUpperCase() + option.value.slice(1)}>
                            <input
                              type="radio"
                              name={`pref-${sourceKey}`}
                              value={option.value}
                              checked={isSelected}
                              onChange={() => handlePreferenceChange(sourceName, option.value)}
                              className="hidden-radio"
                            />
                            <i className={`bi ${iconClass}`}></i>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SEARCH INTERFACE */}
      <div id="track_movie_container">
        <div id="search_bar">
          <form onSubmit={handleSearch} className="search-form">
            <input id="search_box" type="text" placeholder="Have you heard of..." value={movieName} onChange={(e) => setMovieName(e.target.value)} />
            <button type="submit" id="search_button">
              Search
            </button>
          </form>
          {loading && <p>Connecting to Watchmode API...</p>}
          {error && <p className="error-text">{error}</p>}

          {results.length > 0 && (
            <div className="list search-results">
              {results.map((movie) => (
                <div className="search_result" key={movie.id}>
                  <span>
                    <strong>{movie.name}</strong> ({movie.year})
                  </span>
                  <button id="track_button" onClick={() => trackMovie(movie)} className="btn-track">
                    Track
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="filter_bar">
          <div className="toggle-container">
            <label className="switch">
              <input type="checkbox" checked={includeRentals} onChange={(e) => setRentalFlag(e.target.checked)} />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">Include Rentals</span>
          </div>
          {watchlist.length > 0 && (
            <button onClick={checkAllUKAvailability} className="btn-check-all" id="check_movies_button" disabled={batchLoading}>
              {batchLoading ? "Scanning All..." : "Check Availability"}
            </button>
          )}
        </div>
      </div>

      {/* PERSISTENT WATCHLIST */}
      <div id="movie_list_container">
        {watchlist.length === 0 ? (
          <p className="placeholder-text">Not tracking any movies yet. Search and track one above!</p>
        ) : (
          <div className="list">
            {console.log("watchlist", watchlist)}
            {watchlist
              .sort((a, b) => a - b)
              .map((movie) => {
                const movieSources = watchlistAvailability[movie.id];
                return (
                  <div key={movie.id} className="watchlist-item-wrapper">
                    <div className="movie_title">
                      <div>
                        <strong>{movie.name}</strong> <small>({movie.year})</small>
                      </div>
                      <button onClick={() => untrackMovie(movie.id)} className="btn-delete">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>

                    {/* STREAMING STATUS RESULTS FOR EACH MOVIE */}
                    {movieSources && (
                      <div className="inline-availability">
                        {/* filter out elements inline that have been configured as 'disliked' e.g., Amazon obvs */}
                        {movieSources.filter((s) => sourcePreferences[s.name.toLowerCase()] !== "disliked").length === 0 ? (
                          <p className="alert-box negative">Not currently showing in the UK.</p>
                        ) : (
                          <div className="services-grid">
                            {movieSources
                              .filter((source) => sourcePreferences[source.name.toLowerCase()] !== "disliked")
                              .map((source, index) => {
                                const sourceKey = source.name.toLowerCase();
                                const isLoved = sourcePreferences[sourceKey] === "loved";

                                return (
                                  <div key={index} className={`service-pill ${isLoved ? "favourite-highlight" : "standard-pill"}`}>
                                    <span className="platform-name">{source.name}</span>

                                    <span className="badge-type">
                                      {{
                                        sub: "Subscription",
                                        rent: "Rent",
                                        free: "Free",
                                      }[source.type] || source.type}{" "}
                                      {source.type === "rent" ? `${source.format} £${Number(source.price).toFixed(2)}` : ""}
                                    </span>

                                    {/* display heart exclusively if status is explicitly set to 'loved' */}
                                    {isLoved && (
                                      <span className="fav-heart">
                                        <i className="bi bi-heart-fill"></i>
                                      </span>
                                    )}
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