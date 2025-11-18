window.loading = {
    showGlobalWithTimeout(message = "Loading...", timeout = 15000) {
        console.log(message);

        const loader = document.createElement("div");
        loader.id = "global-loading";
        loader.innerHTML = `
            <div class="loader-overlay">
                <div class="loader-box">${message}</div>
            </div>
        `;
        document.body.appendChild(loader);

        this._timeout = setTimeout(() => this.hideGlobal(), timeout);
    },

    hideGlobal() {
        const loader = document.getElementById("global-loading");
        if (loader) loader.remove();
        if (this._timeout) clearTimeout(this._timeout);
    }
};
