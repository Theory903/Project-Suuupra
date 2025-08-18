import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Creator Studio</h1>
        <p>Upload, manage, and track your media content.</p>
      </header>
      <main>
        {/* Placeholder for upload form, media list, etc. */}
        <section>
          <h2>Upload New Media</h2>
          <input type="file" />
          <button>Upload</button>
        </section>
        <section>
          <h2>Your Media</h2>
          <ul>
            <li>Video 1</li>
            <li>Image 1</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
