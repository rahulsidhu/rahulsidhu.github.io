# Rahul Sidhu - Personal Website

A clean, minimal static website hosted on GitHub Pages at [rahulsidhu.github.io](https://rahulsidhu.github.io)

## Features

- **Simple & Fast** - Pure HTML, CSS, and JavaScript (no frameworks required)
- **Responsive Design** - Works great on all devices
- **Easy to Maintain** - Straightforward file structure
- **Blog Ready** - Simple blog template for sharing your thoughts
- **Customizable** - Easy to modify colors, fonts, and content

## Project Structure

```
.
├── index.html              # Home page
├── about.html              # About page
├── contact.html            # Contact page
├── blog/
│   ├── index.html          # Blog listing page
│   └── getting-started.html # Example blog post
├── styles/
│   └── main.css            # Main stylesheet
├── README.md               # This file
└── .gitignore              # Git ignore file
```

## Getting Started

1. **Clone or download** this repository
2. **Customize** the content in each HTML file with your information
3. **Update contact information** in `contact.html`
4. **Add your blog posts** by creating new HTML files in the `blog/` folder
5. **Push to GitHub** - your site will be live at `https://yourusername.github.io`

## Customization

### Update Your Name
Replace "Rahul Sidhu" with your name in:
- `index.html`
- `about.html`
- `contact.html`
- `blog/index.html`

### Update Contact Information
Edit `contact.html` with your actual contact details:
- Email
- GitHub profile
- Social media links

### Add Blog Posts
1. Create a new HTML file in the `blog/` folder
2. Use `blog/getting-started.html` as a template
3. Update the blog listing in `blog/index.html`

### Customize Colors
Edit the CSS variables at the top of `styles/main.css`:
```css
:root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    --accent-color: #e74c3c;
    /* ... */
}
```

## Deploying to GitHub Pages

1. Create a repository named `yourusername.github.io`
2. Push your code to the main branch
3. Your site will be available at `https://yourusername.github.io`

GitHub Pages automatically serves the `index.html` file for the root URL.

## Tips for Blog Posts

- Keep posts well-organized with clear headings
- Use semantic HTML for better readability
- Consider adding post metadata (author, date, reading time)
- Organize blog posts by date or category for better navigation

## License

This project is open source and available for personal use.
