import {

  getMenu,

} from "@/server/modules/demo-store/store";



import {

  getOffers,

} from "@/server/modules/offers/store";

import { getOffersPageNow } from "@/server/modules/offers/page-clock";



import {

  createOfferAction,

  deleteOfferAction,

  toggleOfferAction,

} from "@/server/modules/offers/actions";



async function createOfferFormAction(formData: FormData): Promise<void> {
  "use server";
  await createOfferAction(formData);
}

async function toggleOfferFormAction(id: string, active: boolean): Promise<void> {
  "use server";
  await toggleOfferAction(id, active);
}

async function deleteOfferFormAction(id: string): Promise<void> {
  "use server";
  await deleteOfferAction(id);
}

function formatDate(timestamp: number) {

  return new Intl.DateTimeFormat("en-IN", {

    dateStyle: "medium",

    timeStyle: "short",

  }).format(timestamp);

}



function offerTypeLabel(type: string) {

  switch (type) {

    case "fixed_price":

      return "Fixed price";



    case "percentage":

      return "Percentage";



    case "buy_x_get_y":

      return "Buy X Get Y";



    default:

      return type;

  }

}



function targetLabel(offer: ReturnType<typeof getOffers>[number]) {

  if (offer.targetType === "order") {

    return `Orders above ₹${offer.minimumOrderRupees ?? 0}`;

  }



  if (offer.targetType === "category") {

    return offer.targetCategory ?? "Category";

  }



  const item = getMenu().find(

    (menuItem) => menuItem.id === offer.targetItemId

  );



  return item?.name ?? "Menu item";

}



function offerValueLabel(

  offer: ReturnType<typeof getOffers>[number]

) {

  if (offer.type === "fixed_price") {

    return `₹${offer.fixedPriceRupees}`;

  }



  if (offer.type === "percentage") {

    return `${offer.percentagePercent}% OFF`;

  }



  return `Buy ${offer.buyQuantity} Get ${offer.freeQuantity}`;

}



export default async function OffersPage() {

  const now = await getOffersPageNow();

  const offers = getOffers();

  const menu = getMenu();



  const categories = Array.from(

    new Set(menu.map((item) => item.category))

  );



  return (

    <main className="min-h-screen bg-[#0D0E0B] px-4 py-8 text-[#F2F3EC] md:px-8">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#D7FE3B]">

              Owner Portal

            </p>



            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">

              Offers & Promotions

            </h1>



            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9DA194]">

              Create offers that can later be surfaced across the

              Tablor table-device experience and applied during

              customer checkout.

            </p>

          </div>



          <div className="rounded-xl border border-[#23251F] bg-[#15170F] px-4 py-3">

            <p className="text-xs uppercase tracking-wider text-[#7E8276]">

              Active offers

            </p>



            <p className="mt-1 text-2xl font-semibold text-[#D7FE3B]">

              {offers.filter(
                (offer) =>
                  offer.active &&
                  offer.startsAt <= now &&
                  offer.endsAt > now
              ).length}

            </p>

          </div>

        </div>



        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">

          {/* CREATE */}

          <section className="rounded-2xl border border-[#23251F] bg-[#15170F] p-5 md:p-6">

            <div className="mb-5">

              <h2 className="text-lg font-semibold">

                Create offer

              </h2>



              <p className="mt-1 text-sm text-[#7E8276]">

                Set the promotion rules and schedule.

              </p>

            </div>



            <form

              action={createOfferFormAction}

              className="space-y-4"

            >

              <div>

                <label

                  htmlFor="name"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Offer name

                </label>



                <input

                  id="name"

                  name="name"

                  required

                  placeholder="Chicken Biryani Special"

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none transition focus:border-[#D7FE3B]"

                />

              </div>



              <div>

                <label

                  htmlFor="description"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Description

                </label>



                <textarea

                  id="description"

                  name="description"

                  rows={3}

                  placeholder="Limited-time dinner offer"

                  className="w-full resize-none rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none transition focus:border-[#D7FE3B]"

                />

              </div>



              <div>

                <label

                  htmlFor="type"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Offer type

                </label>



                <select

                  id="type"

                  name="type"

                  defaultValue="fixed_price"

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                >

                  <option value="fixed_price">

                    Fixed promotional price

                  </option>



                  <option value="percentage">

                    Percentage discount

                  </option>



                  <option value="buy_x_get_y">

                    Buy X Get Y

                  </option>

                </select>

              </div>



              <div>

                <label

                  htmlFor="targetType"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Applies to

                </label>



                <select

                  id="targetType"

                  name="targetType"

                  defaultValue="item"

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                >

                  <option value="item">

                    Menu item

                  </option>



                  <option value="category">

                    Category

                  </option>



                  <option value="order">

                    Entire order

                  </option>

                </select>

              </div>



              <div>

                <label

                  htmlFor="targetItemId"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Menu item

                </label>



                <select

                  id="targetItemId"

                  name="targetItemId"

                  defaultValue=""

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                >

                  <option value="">

                    Select menu item

                  </option>



                  {menu.map((item) => (

                    <option key={item.id} value={item.id}>

                      {item.name} — ₹{item.priceRupees}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label

                  htmlFor="targetCategory"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Category

                </label>



                <select

                  id="targetCategory"

                  name="targetCategory"

                  defaultValue=""

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                >

                  <option value="">

                    Select category

                  </option>



                  {categories.map((category) => (

                    <option key={category} value={category}>

                      {category}

                    </option>

                  ))}

                </select>

              </div>



              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label

                    htmlFor="fixedPriceRupees"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Promo price ₹

                  </label>



                  <input

                    id="fixedPriceRupees"

                    name="fixedPriceRupees"

                    type="number"

                    min="0"

                    placeholder="220"

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                  />

                </div>



                <div>

                  <label

                    htmlFor="percentagePercent"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Discount %

                  </label>



                  <input

                    id="percentagePercent"

                    name="percentagePercent"

                    type="number"

                    min="1"

                    max="100"

                    placeholder="10"

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                  />

                </div>

              </div>



              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label

                    htmlFor="buyQuantity"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Buy

                  </label>



                  <input

                    id="buyQuantity"

                    name="buyQuantity"

                    type="number"

                    min="1"

                    placeholder="2"

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                  />

                </div>



                <div>

                  <label

                    htmlFor="freeQuantity"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Get free

                  </label>



                  <input

                    id="freeQuantity"

                    name="freeQuantity"

                    type="number"

                    min="1"

                    placeholder="1"

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                  />

                </div>

              </div>



              <div>

                <label

                  htmlFor="minimumOrderRupees"

                  className="mb-1.5 block text-sm font-medium"

                >

                  Minimum order ₹

                </label>



                <input

                  id="minimumOrderRupees"

                  name="minimumOrderRupees"

                  type="number"

                  min="0"

                  placeholder="500"

                  className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3.5 py-3 text-sm outline-none focus:border-[#D7FE3B]"

                />

              </div>



              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label

                    htmlFor="startsAt"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Starts

                  </label>



                  <input

                    id="startsAt"

                    name="startsAt"

                    type="datetime-local"

                    required

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3 py-3 text-xs outline-none focus:border-[#D7FE3B]"

                  />

                </div>



                <div>

                  <label

                    htmlFor="endsAt"

                    className="mb-1.5 block text-sm font-medium"

                  >

                    Ends

                  </label>



                  <input

                    id="endsAt"

                    name="endsAt"

                    type="datetime-local"

                    required

                    className="w-full rounded-xl border border-[#23251F] bg-[#0D0E0B] px-3 py-3 text-xs outline-none focus:border-[#D7FE3B]"

                  />

                </div>

              </div>



              <input

                type="hidden"

                name="active"

                value="true"

              />



              <button

                type="submit"

                className="w-full rounded-xl bg-[#D7FE3B] px-4 py-3 font-semibold text-[#0D0E0B] transition hover:bg-[#C4EC2A]"

              >

                Create offer

              </button>

            </form>

          </section>



          {/* LIST */}

          <section>

            <div className="mb-4 flex items-center justify-between">

              <div>

                <h2 className="text-lg font-semibold">

                  Your promotions

                </h2>



                <p className="mt-1 text-sm text-[#7E8276]">

                  {offers.length} offer

                  {offers.length === 1 ? "" : "s"} configured

                </p>

              </div>

            </div>



            {offers.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-[#23251F] bg-[#15170F] p-10 text-center">

                <p className="text-sm font-medium">

                  No offers yet

                </p>



                <p className="mt-2 text-sm text-[#7E8276]">

                  Create your first promotion using the form.

                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {offers.map((offer) => {

                  const currentlyActive =
                    offer.active &&
                    offer.startsAt <= now &&
                    offer.endsAt > now;



                  return (

                    <article

                      key={offer.id}

                      className="rounded-2xl border border-[#23251F] bg-[#15170F] p-5"

                    >

                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="font-semibold">

                              {offer.name}

                            </h3>



                            <span

                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${

                                currentlyActive

                                  ? "bg-[#D7FE3B]/10 text-[#D7FE3B]"

                                  : "bg-zinc-800 text-zinc-400"

                              }`}

                            >

                              {currentlyActive

                                ? "ACTIVE"

                                : offer.active

                                  ? "SCHEDULED / EXPIRED"

                                  : "PAUSED"}

                            </span>

                          </div>



                          {offer.description && (

                            <p className="mt-2 text-sm text-[#9DA194]">

                              {offer.description}

                            </p>

                          )}



                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">

                            <div>

                              <p className="text-xs text-[#7E8276]">

                                Offer

                              </p>



                              <p className="mt-1 font-medium text-[#D7FE3B]">

                                {offerValueLabel(offer)}

                              </p>

                            </div>



                            <div>

                              <p className="text-xs text-[#7E8276]">

                                Applies to

                              </p>



                              <p className="mt-1 font-medium">

                                {targetLabel(offer)}

                              </p>

                            </div>



                            <div>

                              <p className="text-xs text-[#7E8276]">

                                Type

                              </p>



                              <p className="mt-1 font-medium">

                                {offerTypeLabel(offer.type)}

                              </p>

                            </div>

                          </div>



                          <div className="mt-4 text-xs text-[#7E8276]">

                            {formatDate(offer.startsAt)}

                            {" → "}

                            {formatDate(offer.endsAt)}

                          </div>

                        </div>



                        <div className="flex shrink-0 gap-2">

                          <form

                            action={toggleOfferFormAction.bind(null, offer.id, !offer.active)}

                          >

                            <button

                              type="submit"

                              className="rounded-lg border border-[#23251F] px-3 py-2 text-xs font-medium text-[#9DA194] transition hover:border-[#D7FE3B] hover:text-[#D7FE3B]"

                            >

                              {offer.active

                                ? "Pause"

                                : "Activate"}

                            </button>

                          </form>



                          <form

                            action={deleteOfferFormAction.bind(null, offer.id)}

                          >

                            <button

                              type="submit"

                              className="rounded-lg border border-[#23251F] px-3 py-2 text-xs font-medium text-[#E27468] transition hover:border-[#E27468]"

                            >

                              Delete

                            </button>

                          </form>

                        </div>

                      </div>

                    </article>

                  );

                })}

              </div>

            )}

          </section>

        </div>

      </div>

    </main>

  );

}