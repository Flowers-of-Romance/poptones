import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import metas from "lume/plugins/metas.ts";

const site = lume({
  location: new URL("https://flowers-of-romance.github.io/poptones/"),
});

site.use(basePath());
site.use(metas());

site.add("css");
site.add("js");
site.add("img");

// Static data files
site.copy([".json"]);

export default site;
