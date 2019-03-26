using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(OwlCarousel.Startup))]
namespace OwlCarousel
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}
