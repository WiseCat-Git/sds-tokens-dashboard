# SDS Tokens Dashboard

A modern web dashboard for tracking Search Design System (SDS) token changes and their impact on Search Result Page (SRP) ads.

## Features

- **Overview Page**: Visual cards showing token changes grouped by LE (Launch Event)
- **Details Page**: Comprehensive table with filtering capabilities
- **Real-time Data**: Connects to Google Sheets for live updates
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Interactive Filters**: Dynamic filtering by status, component, and more

## Setup

1. **Clone Repository**
   ```bash
   git clone [your-repo-url]
   cd tokens-dashboard
   ```

2. **Open in VS Code**
   ```bash
   code .
   ```

3. **Install Live Server Extension**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Live Server"
   - Install the extension

4. **Start Development Server**
   - Right-click on `index.html`
   - Select "Open with Live Server"
   - Dashboard will open in your browser

## Data Configuration

### Option 1: Google Sheets API
Update `script.js` with your Google Sheets API configuration:

```javascript
const CONFIG = {
    DATA_SOURCE: 'YOUR_GOOGLE_SHEETS_API_URL',
    UPDATE_INTERVAL: 300000, // 5 minutes
};
```

### Option 2: JSON File
1. Export your master table as JSON
2. Replace content in `data/tokens-data.json`
3. Update manually when data changes

## Deployment

### GitHub Pages (Free)
1. Push code to GitHub repository
2. Go to repository Settings
3. Enable GitHub Pages from main branch
4. Your dashboard will be live at: `username.github.io/tokens-dashboard`

### Other Options
- **Netlify**: Drag and drop your project folder
- **Vercel**: Connect to GitHub repository
- **Firebase Hosting**: Use Firebase CLI

## Customization

- **Colors**: Edit CSS variables in `styles.css`
- **Layout**: Modify grid and flexbox settings
- **Data Mapping**: Update field mappings in `script.js`
- **Filters**: Add/remove filters in the `generateFilters()` function

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.