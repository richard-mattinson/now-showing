import { useState, useEffect } from "react";
import "./App.css";
import "bootstrap-icons/font/bootstrap-icons.css";

function App() {
  const [movieName, setMovieName] = useState(""); // for storing the search bar movie title
  const [results, setResults] = useState([]); // for storing the results of a movie search
  const [loading, setLoading] = useState(false); // for setting loading animations
  const [error, setError] = useState(""); // for setting api errors
  const [includeRentals, setRentalFlag] = useState(false); // for setting the include rentals flag
  const [includeLovedOnly, setLovedOnlyFlag] = useState(false); // for setting the "Only Display Films on Loved Services" flag
  const [sortBy, setSortBy] = useState("dateAdded"); // for sorting the watchlist sort order

  // TODO: always set as FALSE before pushing
  const shallIGetSources = false; // set as true to check source list

  const apiKey = import.meta.env.VITE_WATCHMODE_API_KEY;

  const sourcesList = [
    "All 4",
    "Amazon",
    "Amazon Freevee",
    "AppleTV+",
    "BBC iPlayer",
    "BFI Player",
    "Crunchyroll Premium",
    "Curzon Home Cinema",
    "Disney+",
    "ITVX",
    "Kanopy",
    "Mubi",
    "My5",
    "Netflix",
    "NOW TV",
    "Paramount+",
    "Prime Video",
    "Rakuten TV",
    "Shudder",
    "Sky Go",
    "Sky Store",
    "Tubi TV",
  ];

  /////////////////////// RELEASE NOTES MENU ///////////////////////

  const versionNumber = "0.8";
  const releaseDate = "2026-07-05";

  const upcomingChanges = ["I haven't got any at the moment... make a request!"];

  const releaseNotes = [
    "0.8 - Last updated date in title bar",
    "0.8 - Display availability on load (based on last check)",
    "0.7 - Fixed Release Notes menu not closing",
    "0.7 - Added 'Loved Only' filter",
    "0.6 - Added Release Notes",
    "0.5 - Added services to Preferred Sources menu",
    "0.5 - Added sorting by Added Date, Year and Title",
  ];

  // controls whether the release notes menu is open or closed
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  /////////////////////// SERVICES PREFERENCES MENU ///////////////////////

  // tracks saved liked/loved/disliked settings
  const [sourcePreferences, setSourcePreferences] = useState(() => {
    const saved = localStorage.getItem("uk_source_preferences");
    return saved ? JSON.parse(saved) : {};
  });

  console.log("saved sources", sourcePreferences);

  // controls whether the gear menu menu is open or closed
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

  /////////////////////// MANAGE WATCH LIST ///////////////////////

  // load watchlist from local storage on startup
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("now-showing-watchlist");
    return saved ? JSON.parse(saved) : [];
  });

  let lastUpdated = watchlist[0].availabilityCheckedDate;
  console.log("last", lastUpdated);

  // save watchlist to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("now-showing-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  // store the streaming availability results for all checked movies
  // format: { [movieId]: [array of UK sources] }
  const [watchlistAvailability, setWatchlistAvailability] = useState(() => {
    const cachedResults = {};
    const todayString = new Date().toISOString().split("T")[0];

    // load last cached availability on load if available
    if (Array.isArray(watchlist)) {
      watchlist.forEach((movie) => {
        if (movie.availabilityCheckedDate === todayString && movie.cachedAvailability) {
          cachedResults[movie.id] = movie.cachedAvailability;
        } else {
          cachedResults[movie.id] = movie.cachedAvailability || [];
        }
      });
    }

    return cachedResults;
  });
  const [batchLoading, setBatchLoading] = useState(false);

  // sync watchlist data array to local storage
  useEffect(() => {
    localStorage.setItem("now-showing-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  /////////////////////// GET SOURCES ///////////////////////

  const getSources = async () => {
    const urlSources = `https://api.watchmode.com/v1/sources/?apiKey=${apiKey}&regions=UK,GB`;

    const response = await fetch(urlSources);
    const jsonSources = await response.json();
    console.log("sources", jsonSources);
  };

  if (shallIGetSources) {
    getSources();
  }

  /////////////////////// SEARCH AND TRACK MOVIES ///////////////////////

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

    const dateNow = new Date();
    movie.dateAdded = `${dateNow}`;

    // initialise daily check availability properties
    movie.availabilityCheckedDate = null;
    movie.cachedAvailability = [];

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

  /////////////////////// CHECK WATCH LIST AVAILABILITY ///////////////////////

  // loadCachedAvailabilityOnLoad()

  const checkAllUKAvailability = async () => {
    if (watchlist.length === 0) {
      alert("Your watchlist is empty! Add movies first.");
      return;
    }

    setBatchLoading(true);
    const newAvailabilityResults = {};
    const updatedWatchlist = [...watchlist];
    const todayString = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    for (let i = 0; i < updatedWatchlist.length; i++) {
      const movie = updatedWatchlist[i];
      const movieId = movie.id;

      // check if already fetched today
      if (movie.availabilityCheckedDate === todayString) {
        console.log(`Using cached data for ${movie.name}`);
        newAvailabilityResults[movieId] = movie.cachedAvailability || [];
        continue;
      }

      const url = `https://api.watchmode.com/v1/title/${movieId}/sources/?apiKey=${apiKey}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const sourcesData = await response.json();

        const ukStreaming = sourcesData.filter((source) => {
          const isValidType = source.type === "sub" || source.type === "free" || source.type === "rent";
          const isValidRegion = source.region === "UK" || source.region === "GB";
          return isValidType && isValidRegion;
        });

        // update cached data and timestamp for this movie
        updatedWatchlist[i] = {
          ...movie,
          availabilityCheckedDate: todayString,
          cachedAvailability: ukStreaming,
        };

        newAvailabilityResults[movieId] = ukStreaming;
      } catch (err) {
        console.error(`Could not fetch data for ${movie.name}:`, err.message);

        // keep old cache on failure or set empty
        newAvailabilityResults[movieId] = movie.cachedAvailability || [];
      }
    }

    // Update both states to keep them in sync
    setWatchlist(updatedWatchlist);
    setWatchlistAvailability(newAvailabilityResults);
    setBatchLoading(false);
  };

  /////////////////////// CLOSE RELEASE NOTES MENU ///////////////////////

  // close pop up menu if user clicks outside menu while it's open
  useEffect(() => {
    const closeMenu = (e) => {
      // if the click came from the gear button or inside the menu, do nothing
      if (e.target.closest(".control-info-btn") || e.target.closest(".global-release-notes-menu")) {
        return;
      }
      // otherwise, close the menu
      setShowReleaseNotes(false);
    };

    if (showReleaseNotes) {
      window.addEventListener("click", closeMenu);
    }

    return () => window.removeEventListener("click", closeMenu);
  }, [showReleaseNotes]);

  /////////////////////// CLOSE SERVICE PREFERENCES MENU ///////////////////////

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

  /////////////////////// RENDER FRONT END ///////////////////////

  return (
    <div className="container">
      <div id="control_bar">
        {/* /////////////////////// RELEASE NOTES ICON /////////////////////// */}
        <button className="control-info-btn" onClick={() => setShowReleaseNotes(!showReleaseNotes)} aria-label="Toggle Release Notes">
          <i className="bi bi-info-circle"></i>
        </button>

        {/* /////////////////////// APP TITLE /////////////////////// */}
        <div className="app_title">NOW SH</div>
        <i className="bi bi-tv" id="app_icon"></i>
        <div className="app_title">WING</div>

        {/* /////////////////////// PREFERRED SERVICES ICON /////////////////////// */}
        <button className="control-gear-btn" onClick={() => setShowSettings(!showSettings)} aria-label="Toggle Source Settings">
          <i className="bi bi-gear-fill"></i>
        </button>

        {/* /////////////////////// RELEASE NOTES MENU /////////////////////// */}
        {showReleaseNotes && (
          <div className="global-release-notes-menu">
            <h5>
              Version {versionNumber} - {releaseDate}
            </h5>
            <h4>Planned Updates</h4>
            <div className="menu-release-notes-list">
              <ul>
                {upcomingChanges.map((change) => {
                  return <li className="menu-release-notes-item">{change}</li>;
                })}
              </ul>
            </div>
            <h4>Previous Updates</h4>
            <div className="menu-release-notes-list">
              <ul>
                {releaseNotes.map((change) => {
                  return <li className="menu-release-notes-item">{change}</li>;
                })}
              </ul>
            </div>
          </div>
        )}

        {/* /////////////////////// SERVICE PREFERENCES MENU /////////////////////// */}
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
                        // uses filled versions of each icon when selected.
                        let iconClass = isSelected
                          ? {
                              liked: "bi-hand-thumbs-up-fill",
                              disliked: "bi-hand-thumbs-down-fill",
                              loved: "bi-heart-fill",
                            }[option.value] || option.icon
                          : option.icon;
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

      {/* /////////////////////// SEARCH BAR /////////////////////// */}
      <div id="track_movie_container">
        <div id="search_bar">
          <form onSubmit={handleSearch} className="search-form">
            <input id="search_box" type="text" placeholder="Have you heard of..." value={movieName} onChange={(e) => setMovieName(e.target.value)} />
            <button type="submit" id="search_button">
              Search
            </button>
          </form>
          {loading && <p>Checking the stockroom...</p>}
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
      </div>

      {/* /////////////////////// CHECK AVAILABILITY BUTTON /////////////////////// */}

      <div id="check_movies_bar">
        <div id="last_checked">Last updated: {lastUpdated}</div>
        {watchlist.length > 0 && (
          <button onClick={checkAllUKAvailability} className="btn-check-all" id="check_movies_button" disabled={batchLoading}>
            {batchLoading ? "One moment..." : "Check Availability"}
          </button>
        )}
      </div>

      {/* /////////////////////// FILTER BAR /////////////////////// */}
      <div id="filter_bar">
        {/* /////////////////////// INCLUDE RENTALS BUTTON /////////////////////// */}
        <div className="toggle-container">
          <label className="switch">
            <input type="checkbox" checked={includeRentals} onChange={(e) => setRentalFlag(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">Include Rentals</span>
        </div>
        {/* /////////////////////// INCLUDE ONLY LOVED SERVICES BUTTON /////////////////////// */}
        <div className="toggle-container">
          <label className="switch">
            <input type="checkbox" checked={includeLovedOnly} onChange={(e) => setLovedOnlyFlag(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">Only Loved</span>
        </div>
      </div>

      {/* /////////////////////// SORT WATCHLIST BUTTONS /////////////////////// */}
      <div id="sort-buttons-container">
        <div id="sort-buttons-label">Sort by</div>
        <button className={`btn-sort ${sortBy === "dateAdded" ? "selected" : ""}`} onClick={() => setSortBy("dateAdded")}>
          <i className="bi bi-clock-history"></i> Added
        </button>
        <button className={`btn-sort ${sortBy === "name" ? "selected" : ""}`} onClick={() => setSortBy("name")}>
          <i className="bi bi-sort-alpha-down"></i> Name
        </button>
        <button className={`btn-sort ${sortBy === "year" ? "selected" : ""}`} onClick={() => setSortBy("year")}>
          <i className="bi bi-calendar3"></i> Year
        </button>
      </div>

      {/* /////////////////////// WATCHLIST /////////////////////// */}
      <div id="movie_list_container">
        {watchlist.length === 0 ? (
          <p className="placeholder-text">Not tracking any movies yet. Search and track one above!</p>
        ) : (
          <div className="list">
            {console.log("watchlist", watchlist)}
            {/* slice creates a shallow copy to prevent direct state mutation during sort */}
            {watchlist
              .slice()
              .sort((a, b) => {
                if (sortBy === "dateAdded") {
                  return new Date(b.dateAdded) - new Date(a.dateAdded); // newest added first
                } else if (sortBy === "name") {
                  return a.name.localeCompare(b.name); // a-z
                } else if (sortBy === "year") {
                  return b.year - a.year; // newest year first (change to a.year - b.year for oldest first)
                }
                return 0;
              })
              .map((movie) => {
                const movieSources = watchlistAvailability[movie.id];

                // filter sources based on service preferences, includeRentals toggle & only loved toggle
                const visibleSources = movieSources
                  ? movieSources.filter((source) => {
                      // if loved only flag is set only show loved services, else show all non disliked services
                      const sourceIsNotDisliked = includeLovedOnly ? sourcePreferences[source.name.toLowerCase()] === "loved" : sourcePreferences[source.name.toLowerCase()] !== "disliked";
                      // if item is not a rental include it, else only include it if the includeRentals flag is set to true
                      const matchesRentalToggle = source.type !== "rent" || includeRentals;

                      return sourceIsNotDisliked && matchesRentalToggle;
                    })
                  : [];

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

                    {/* /////////////////////// AVAILABILITY FOR EACH MOVIE /////////////////////// */}
                    {movieSources && (
                      <div className="inline-availability">
                        {/* check the length of filtered film array */}
                        {visibleSources.length === 0 ? (
                          <p className="alert-box negative">Not currently showing in the UK.</p>
                        ) : (
                          <div className="services-grid">
                            {/* map filtered films */}
                            {visibleSources.map((source, index) => {
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